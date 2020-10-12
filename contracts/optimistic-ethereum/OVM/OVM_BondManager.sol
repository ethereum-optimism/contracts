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
    string constant NOT_ENOUGH_COLLATERAL = "BondManager: Sequencer is not sufficiently collateralized";
    string constant LOW_VALUE = "BondManager: New collateral value must be greater than the previous one";
    string constant ALREADY_FINALIZED = "BondManager: Fraud proof for this pre-state root has already been finalized";
    string constant SLASHED = "BondManager: Cannot finalize withdrawal, you probably got slashed";
    string constant CANNOT_CLAIM = "BondManager: Cannot claim yet. Dispute must be finalized first";

    string constant WITHDRAWAL_PENDING = "BondManager: Withdrawal already pending";
    string constant TOO_EARLY = "BondManager: Too early to finalize your withdrawal";

    string constant ONLY_OWNER = "BondManager: Only the contract's owner can call this function";
    string constant ONLY_TRANSITIONER = "BondManager: Only the transitioner for this pre-state root may call this function";
    string constant ONLY_FRAUD_VERIFIER = "BondManager: Only the fraud verifier may call this function";
    string constant ONLY_STATE_COMMITMENT_CHAIN = "BondManager: Only the state commitment chain may call this function";
}

contract OVM_BondManager is Lib_AddressResolver {
    /// Owner used to bump the security bond size
    address public owner;

    /// The bond token
    ERC20 immutable public token;

    /// The fraud verifier contract, used to get data about transitioners for a pre-state root
    // address public ovmFraudVerifier;
    address public ovmCanonicalStateCommitmentChain;

    uint256 requiredCollateral = 1 ether;

    /// A bond posted by a sequencer
    /// The bonds posted by each sequencer
    struct Bond {
        uint256 locked;
        uint256 withdrawing;
        uint256 withdrawalTimestamp;

    }
    mapping(address => Bond) public bonds;

    /// The dispute period
    uint256 public disputePeriodSeconds = 7 days;

    // Per pre-state root, store the number of state provisions that were made
    // and how many of these calls were made by each user. Payouts will then be
    // claimed by users proportionally for that dispute.
    struct Rewards {
        bool canClaim;
        // Total number of `storeWitnessProvider` calls made
        uint256 total;
        // The sum of all values inside this map MUST be equal to the
        // value of `totalClaims`
        mapping(address => uint256) numClaims;
    }
    /// For each pre-state root, there's an array of witnessProviders that must be rewarded
    /// for posting witnesses
    mapping(bytes32 => Rewards) public witnessProviders;

    /// Initializes with a ERC20 token to be used for the fidelity bonds
    /// and with the Address Manager
    constructor(ERC20 _token, address _libAddressManager)
        Lib_AddressResolver(_libAddressManager)
    {
        owner = msg.sender;
        token = _token;
        // ovmFraudVerifier = resolve("OVM_FraudVerifier"); // TODO: Re-enable this
        ovmCanonicalStateCommitmentChain = resolve("OVM_CanonicalStateCommitmentChain");
    }

    /// Adds `who` to the list of witnessProviders for the provided `preStateRoot`.
    function storeWitnessProvider(bytes32 _preStateRoot, address who) public {
        // The sender must be the transitioner that corresponds to the claimed pre-state root
        address transitioner = address(iOVM_FraudVerifier(resolve("OVM_FraudVerifier")).getStateTransitioner(_preStateRoot));
        require(transitioner == msg.sender, Errors.ONLY_TRANSITIONER);

        witnessProviders[_preStateRoot].total += 1;
        witnessProviders[_preStateRoot].numClaims[who] += 1;
    }

    /// Slashes + distributes rewards or frees up the sequencer's bond, only called by
    /// `FraudVerifier.finalizeFraudVerification`
    function finalize(bytes32 _preStateRoot, uint256 batchIndex, address publisher, uint256 timestamp) public {
        require(msg.sender == resolve("OVM_FraudVerifier"), Errors.ONLY_FRAUD_VERIFIER);
        require(witnessProviders[_preStateRoot].canClaim == false, Errors.ALREADY_FINALIZED);

        // allow users to claim from that state root's
        // pool of collateral (effectively slashing the sequencer)
        witnessProviders[_preStateRoot].canClaim = true;

        Bond storage bond = bonds[publisher];

        // always slash 1 round of collateral, if possible
        if (bond.locked >= requiredCollateral) {
            bond.locked -= requiredCollateral;
        }

        // if the publisher has a pending withdrawal that's within the published
        // block's challenge period
        if (
            bond.withdrawalTimestamp != 0 && 
            bond.withdrawalTimestamp <= timestamp + disputePeriodSeconds &&
            bond.withdrawing >= requiredCollateral
        ) {
            bond.withdrawing -= requiredCollateral;
        }
    }

    /// Starts the withdrawal for a publisher
    function startWithdrawal() public {
        Bond storage bond = bonds[msg.sender];
        require(bond.withdrawalTimestamp == 0, Errors.WITHDRAWAL_PENDING);
        require(bond.locked >= requiredCollateral, Errors.NOT_ENOUGH_COLLATERAL);
        bond.locked -= requiredCollateral;

        bond.withdrawing += requiredCollateral;
        bond.withdrawalTimestamp = block.timestamp;
    }

    /// Finalizes a pending withdrawal from a publisher
    function finalizeWithdrawal() public {
        Bond storage bond = bonds[msg.sender];

        require(
            block.timestamp >= bond.withdrawalTimestamp + disputePeriodSeconds, 
            Errors.TOO_EARLY
        );
        require(bond.withdrawing >= requiredCollateral, Errors.SLASHED);
        bond.withdrawing -= requiredCollateral;
        bond.withdrawalTimestamp = 0;
        
        require(
            token.transfer(msg.sender, requiredCollateral),
            Errors.ERC20_ERR
        );
    }

    // Claims the user's proportion of the provided state
    function claim(bytes32 _preStateRoot) public {
        Rewards storage rewards = witnessProviders[_preStateRoot];

        // only allow claiming if fraud was proven in `finalize`
        require(rewards.canClaim, Errors.CANNOT_CLAIM);

        // proportional allocation - only reward 50% (rest gets locked in the
        // contract forever
        uint256 amount = (requiredCollateral * rewards.numClaims[msg.sender]) / (2 * rewards.total);

        // reset the user's claims so they cannot double claim
        rewards.numClaims[msg.sender] = 0;

        // transfer
        require(token.transfer(msg.sender, amount), Errors.ERC20_ERR);
    }

    ////////////////////////
    // Collateral Management
    ////////////////////////

    // Checks if the user is collateralized for the batchIndex
    function isCollateralized(address who, uint256 batchIndex) public view returns (bool) {
        require(msg.sender == ovmCanonicalStateCommitmentChain, Errors.ONLY_STATE_COMMITMENT_CHAIN);
        require(bonds[who].locked >= requiredCollateral, Errors.NOT_ENOUGH_COLLATERAL);
        return true;
    }

    /// Sequencers call this function to post collateral which will be used for
    /// the `appendBatch` call
    function deposit(uint256 amount) public {
        require(
            token.transferFrom(msg.sender, address(this), amount),
            Errors.ERC20_ERR
        );

        // This cannot overflow
        bonds[msg.sender].locked += amount;
    }

    /// Sets the required collateral for posting a state root
    /// Callable only by the contract's deployer.
    function setRequiredCollateral(uint256 newValue) public {
        require(newValue > requiredCollateral, Errors.LOW_VALUE);
        require(msg.sender == owner, Errors.ONLY_OWNER);
        requiredCollateral = newValue;
    }

    function getNumberOfClaims(bytes32 preStateRoot, address who) public view returns (uint256) {
        return witnessProviders[preStateRoot].numClaims[who];
    }
}
