// SPDX-License-Identifier: MIT
pragma solidity >0.5.0 <0.8.0;
pragma experimental ABIEncoderV2;

/* Interface Imports */
import { iOVM_DepositedERC721 } from "../../../iOVM/bridge/tokens/iOVM_DepositedERC721.sol";
import { iOVM_ERC721Gateway } from "../../../iOVM/bridge/tokens/iOVM_ERC721Gateway.sol";

/* Library Imports */
import { OVM_CrossDomainEnabled } from "../../../libraries/bridge/OVM_CrossDomainEnabled.sol";

/**
 * @title Abs_DepositedERC721
 * @dev An Deposited Token is a representation of funds which were deposited from the other side
 * Usually contract mints new tokens when it hears about deposits from the other side.
 * This contract also burns the tokens intended for withdrawal, informing the gateway to release the funds.
 *
 * NOTE: This abstract contract gives all the core functionality of a deposited token implementation except for the
 * token's internal accounting itself.  This gives developers an easy way to implement children with their own token code.
 *
 * Compiler used: solc, optimistic-solc
 * Runtime target: EVM or OVM
 */
abstract contract Abs_DepositedERC721 is iOVM_DepositedERC721, OVM_CrossDomainEnabled {

    /*******************
     * Contract Events *
     *******************/

    event Initialized(iOVM_ERC721Gateway tokenGateway);

    /********************************
     * External Contract References *
     ********************************/

    iOVM_ERC721Gateway public tokenGateway;

    /********************************
     * Constructor & Initialization *
     ********************************/

    /**
     * @param _messenger Messenger address being used for cross-chain communications.
     */
    constructor(
        address _messenger
    )
        OVM_CrossDomainEnabled(_messenger)
    {}

    /**
     * @dev Initialize this contract with the token gateway address on the otehr side.
     * The flow: 1) this contract gets deployed on one side, 2) the
     * gateway is deployed with addr from (1) on the other, 3) gateway address passed here.
     *
     * @param _tokenGateway Address of the corresponding gateway deployed to the other side
     */

    function init(
        iOVM_ERC721Gateway _tokenGateway
    )
        public
    {
        require(address(_tokenGateway) == address(0), "Contract has already been initialized");

        tokenGateway = _tokenGateway;

        emit Initialized(tokenGateway);
    }

    /**********************
     * Function Modifiers *
     **********************/

    modifier onlyInitialized() {
        require(address(tokenGateway) != address(0), "Contract has not yet been initialized");
        _;
    }

    /********************************
     * Overridable Accounting logic *
     ********************************/

    // Default gas value which can be overridden if more complex logic runs on L2.
    uint32 constant DEFAULT_FINALIZE_WITHDRAWAL_GAS = 100000;

    /**
     * @dev Core logic to be performed when a withdrawal from L2 is initialized.
     * In most cases, this will simply burn the withdrawn L2 funds.
     *
     * param _to Address being withdrawn to
     * param _tokenId Token being withdrawn
     */

    function _handleInitiateWithdrawal(
        address, // _to,
        uint // _tokenId
    )
        internal
        virtual
    {
        revert("Accounting must be implemented by child contract.");
    }

    /**
     * @dev Core logic to be performed when a deposit is finalised.
     * In most cases, this will simply _mint() the ERC721 the recipient.
     *
     * param _to Address being deposited to
     * param _tokenId ERC721 which was deposited
     * param _tokenURI URI of the ERC721 which was deposited
     */
    function _handleFinalizeDeposit(
        address, // _to
        uint,// _tokenId
        string memory
    )
        internal
        virtual
    {
        revert("Accounting must be implemented by child contract.");
    }

    /**
     * @dev Overridable getter for the *Other side* gas limit of settling the withdrawal, in the case it may be
     * dynamic, and the above public constant does not suffice.
     *
     */

    function getFinalizeWithdrawalGas()
        public
        view
        virtual
        returns(
            uint32
        )
    {
        return DEFAULT_FINALIZE_WITHDRAWAL_GAS;
    }


    /***************
     * Withdrawing *
     ***************/

    /**
     * @dev initiate a withdraw of an ERC721 to the caller's account on the other side
     * @param _tokenId ERC721 token to withdraw
     */
    function withdraw(
        uint _tokenId
    )
        external
        override
        onlyInitialized()
    {
        _initiateWithdrawal(msg.sender, _tokenId);
    }

    /**
     * @dev initiate a withdraw of an ERC721 to a recipient's account on the other side
     * @param _to adress to credit the withdrawal to
     * @param _tokenId ERC721 token to withdraw
     */
    function withdrawTo(
        address _to,
        uint _tokenId
    )
        external
        override
        onlyInitialized()
    {
        _initiateWithdrawal(_to, _tokenId);
    }

    /**
     * @dev Performs the logic for withdrawals
     *
     * @param _to Account to give the withdrawal to on the other side
     * @param _tokenId ERC721 token to withdraw
     */
    function _initiateWithdrawal(
        address _to,
        uint _tokenId
    )
        internal
    {
        // Call our withdrawal accounting handler implemented by child contracts (usually a _burn)
        _handleInitiateWithdrawal(_to, _tokenId);

        // Construct calldata for ERC721Gateway.finalizeWithdrawal(_to, _tokenId)
        bytes memory data = abi.encodeWithSelector(
            iOVM_ERC721Gateway.finalizeWithdrawal.selector,
            _to,
            _tokenId
        );

        // Send message up to L1 gateway
        sendCrossDomainMessage(
            address(tokenGateway),
            data,
            getFinalizeWithdrawalGas()
        );

        emit WithdrawalInitiated(msg.sender, _to, _tokenId);
    }

    /************************************
     * Cross-chain Function: Depositing *
     ************************************/

    /**
     * @dev Complete a deposit, and credits funds to the recipient's balance of the
     * specified ERC721
     * This call will fail if it did not originate from a corresponding deposit in OVM_ERC721Gateway.
     *
     * @param _to Address to receive the withdrawal at
     * @param _tokenId ERC721 to deposit
     * @param _tokenURI URI of the token being deposited
     */
    function finalizeDeposit(
        address _to,
        uint _tokenId,
        string memory _tokenURI
    )
        external
        override
        onlyInitialized()
        onlyFromCrossDomainAccount(address(tokenGateway))
    {
        _handleFinalizeDeposit(_to, _tokenId, _tokenURI);
        emit DepositFinalized(_to, _tokenId, _tokenURI);
    }
}
