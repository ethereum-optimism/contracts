// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.0;

import { Lib_AddressResolver } from "../libraries/resolver/Lib_AddressResolver.sol";
import { iOVM_FraudVerifier } from "../iOVM/verification/iOVM_FraudVerifier.sol";

interface ERC20 {
    function transfer(address, uint256) external returns (bool);
    function transferFrom(address, address, uint256) external returns (bool);
}

/// All the errors which may be encountered on the bond manager
library Errors {
    string constant ERC20_ERR = "BondManager: Could not post bond";
    string constant LOW_VALUE = "BondManager: New collateral value must be greater than the previous one";
    string constant HIGH_VALUE = "BondManager: New collateral value cannot be more than 5x of the previous one";
    string constant ALREADY_FINALIZED = "BondManager: Fraud proof for this pre-state root has already been finalized";
    string constant SLASHED = "BondManager: Cannot finalize withdrawal, you probably got slashed";
    string constant WRONG_STATE = "BondManager: Wrong bond state for proposer";
    string constant CANNOT_CLAIM = "BondManager: Cannot claim yet. Dispute must be finalized first";

    string constant WITHDRAWAL_PENDING = "BondManager: Withdrawal already pending";
    string constant TOO_EARLY = "BondManager: Too early to finalize your withdrawal";

    string constant ONLY_OWNER = "BondManager: Only the contract's owner can call this function";
    string constant ONLY_TRANSITIONER = "BondManager: Only the transitioner for this pre-state root may call this function";
    string constant ONLY_FRAUD_VERIFIER = "BondManager: Only the fraud verifier may call this function";
    string constant ONLY_STATE_COMMITMENT_CHAIN = "BondManager: Only the state commitment chain may call this function";
}

contract OVM_BondManager is Lib_AddressResolver {

    /*******************
     * Data Structures *
     *******************/

    /// The lifecycle of a proposer's bond
    enum State {
        // Before depositing or after getting slashed, a user is uncollateralized
        NOT_COLLATERALIZED,
        // After depositing, a user is collateralized
        COLLATERALIZED,
        // After a user has initiated a withdrawal
        WITHDRAWING
    }

    /// A bond posted by a proposer
    struct Bond {
        // The user's state
        State state;
        // The timestamp at which a proposer issued their withdrawal request
        uint32 withdrawalTimestamp;
    }

    // Per pre-state root, store the number of state provisions that were made
    // and how many of these calls were made by each user. Payouts will then be
    // claimed by users proportionally for that dispute.
    struct Rewards {
        // Flag to check if rewards for a fraud proof are claimable
        bool canClaim;
        // Total number of `recordGasSpent` calls made
        uint256 total;
        // The gas spent by each user to provide witness data. The sum of all 
        // values inside this map MUST be equal to the value of `total`
        mapping(address => uint256) gasSpent;
    }

    /****************************
     * Constants and Parameters *
     ****************************/

    /// The dispute period
    uint256 public constant disputePeriodSeconds = 7 days;

    /// The minimum collateral a sequencer must post
    uint256 public requiredCollateral = 1 ether;

    /// The maximum multiplier for updating the `requiredCollateral`
    uint256 public constant MAX = 5;

    /// Owner used to bump the security bond size
    address immutable public owner;

    /*******************************************
     * Contract Variables: Contract References *
     *******************************************/

    /// The bond token
    ERC20 immutable public token;

    /// The fraud verifier contract, used to get data about transitioners for a pre-state root
    address public ovmFraudVerifier;

    /********************************************
     * Contract Variables: Internal Accounting  *
     *******************************************/

    /// The bonds posted by each proposer
    mapping(address => Bond) public bonds;

    /// For each pre-state root, there's an array of witnessProviders that must be rewarded
    /// for posting witnesses
    mapping(bytes32 => Rewards) public witnessProviders;

    /***************
     * Constructor *
     ***************/

    /// Initializes with a ERC20 token to be used for the fidelity bonds
    /// and with the Address Manager
    constructor(ERC20 _token, address _libAddressManager)
        Lib_AddressResolver(_libAddressManager)
    {
        owner = msg.sender;
        token = _token;
        ovmFraudVerifier = resolve("OVM_FraudVerifier");
    }

    /********************
     * Public Functions *
     ********************/

    /// Adds `who` to the list of witnessProviders for the provided `preStateRoot`.
    function recordGasSpent(bytes32 _preStateRoot, address who, uint256 gasSpent) public {
        // The sender must be the transitioner that corresponds to the claimed pre-state root
        address transitioner = address(iOVM_FraudVerifier(ovmFraudVerifier).getStateTransitioner(_preStateRoot));
        require(transitioner == msg.sender, Errors.ONLY_TRANSITIONER);

        witnessProviders[_preStateRoot].total += gasSpent;
        witnessProviders[_preStateRoot].gasSpent[who] += gasSpent;
    }

    /// Slashes + distributes rewards or frees up the sequencer's bond, only called by
    /// `FraudVerifier.finalizeFraudVerification`
    function finalize(bytes32 _preStateRoot, uint256 batchIndex, address publisher, uint256 timestamp) public {
        require(msg.sender == ovmFraudVerifier, Errors.ONLY_FRAUD_VERIFIER);
        require(witnessProviders[_preStateRoot].canClaim == false, Errors.ALREADY_FINALIZED);

        // allow users to claim from that state root's
        // pool of collateral (effectively slashing the sequencer)
        witnessProviders[_preStateRoot].canClaim = true;

        Bond storage bond = bonds[publisher];

        // if the fraud proof's dispute period does not intersect with the 
        // withdrawal's timestamp, then the user should not be slashed
        // e.g if a user at day 10 submits a withdrawal, and a fraud proof
        // from day 1 gets published, the user won't be slashed since day 8 (1d + 7d)
        // is before the user started their withdrawal. on the contrary, if the user
        // had started their withdrawal at, say, day 6, they would be slashed
        if (
            bond.withdrawalTimestamp != 0 && 
            uint256(bond.withdrawalTimestamp) > timestamp + disputePeriodSeconds &&
            bond.state == State.WITHDRAWING
        ) {
            return;
        }

        // slash!
        bond.state = State.NOT_COLLATERALIZED;
    }

    /// Sequencers call this function to post collateral which will be used for
    /// the `appendBatch` call
    function deposit(uint256 amount) public {
        require(
            token.transferFrom(msg.sender, address(this), amount),
            Errors.ERC20_ERR
        );

        // This cannot overflow
        bonds[msg.sender].state = State.COLLATERALIZED;
    }

    /// Starts the withdrawal for a publisher
    function startWithdrawal() public {
        Bond storage bond = bonds[msg.sender];
        require(bond.withdrawalTimestamp == 0, Errors.WITHDRAWAL_PENDING);
        require(bond.state == State.COLLATERALIZED, Errors.WRONG_STATE);

        bond.state = State.WITHDRAWING;
        bond.withdrawalTimestamp = uint32(block.timestamp);
    }

    /// Finalizes a pending withdrawal from a publisher
    function finalizeWithdrawal() public {
        Bond storage bond = bonds[msg.sender];

        require(
            block.timestamp >= uint256(bond.withdrawalTimestamp) + disputePeriodSeconds, 
            Errors.TOO_EARLY
        );
        require(bond.state == State.WITHDRAWING, Errors.SLASHED);
        
        // refunds!
        bond.state = State.NOT_COLLATERALIZED;
        bond.withdrawalTimestamp = 0;
        
        require(
            token.transfer(msg.sender, requiredCollateral),
            Errors.ERC20_ERR
        );
    }

    /// Claims the user's reward for the witnesses they provided
    function claim(bytes32 _preStateRoot) public {
        Rewards storage rewards = witnessProviders[_preStateRoot];

        // only allow claiming if fraud was proven in `finalize`
        require(rewards.canClaim, Errors.CANNOT_CLAIM);

        // proportional allocation - only reward 50% (rest gets locked in the
        // contract forever
        uint256 amount = (requiredCollateral * rewards.gasSpent[msg.sender]) / (2 * rewards.total);

        // reset the user's spent gas so they cannot double claim
        rewards.gasSpent[msg.sender] = 0;

        // transfer
        require(token.transfer(msg.sender, amount), Errors.ERC20_ERR);
    }

    /// Sets the required collateral for posting a state root
    /// Callable only by the contract's deployer.
    function setRequiredCollateral(uint256 newValue) public {
        require(newValue > requiredCollateral, Errors.LOW_VALUE);
        require(newValue < MAX * requiredCollateral, Errors.HIGH_VALUE);
        require(msg.sender == owner, Errors.ONLY_OWNER);
        requiredCollateral = newValue;
    }

    /// Checks if the user is collateralized for the batchIndex
    function isCollateralized(address who) public view returns (bool) {
        return bonds[who].state == State.COLLATERALIZED;
    }

    /// Gets how many witnesses the user has provided for the state root
    function getGasSpent(bytes32 preStateRoot, address who) public view returns (uint256) {
        return witnessProviders[preStateRoot].gasSpent[who];
    }
}
