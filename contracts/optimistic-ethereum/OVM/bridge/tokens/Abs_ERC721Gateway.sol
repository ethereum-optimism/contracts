// SPDX-License-Identifier: MIT
pragma solidity >0.5.0 <0.8.0;
pragma experimental ABIEncoderV2;

/* Interface Imports */
import { iOVM_ERC721Gateway } from "../../../iOVM/bridge/tokens/iOVM_ERC721Gateway.sol";
import { iOVM_DepositedERC721 } from "../../../iOVM/bridge/tokens/iOVM_DepositedERC721.sol";
import { IERC721Metadata } from "../../../libraries/standards/ERC721/extensions/IERC721Metadata.sol";

/* Library Imports */
import { OVM_CrossDomainEnabled } from "../../../libraries/bridge/OVM_CrossDomainEnabled.sol";

/**
 * @title Abs_ERC721Gateway
 * @dev An ERC721 Gateway is a contract which stores deposited ERC721 tokens that
 * are in use on the other side of the bridge.
 * It synchronizes a corresponding representation of the "deposited token" on
 * the other side, informing it of new deposits and releasing tokens when there
 * are newly finalized withdrawals.
 *
 * NOTE: This abstract contract gives all the core functionality of an ERC721 token gateway,
 * but provides easy hooks in case developers need extensions in child contracts.
 * In many cases, the default OVM_ERC721Gateway will suffice.
 *
 * Compiler used: solc, optimistic-solc
 * Runtime target: EVM or OVM
 */
abstract contract Abs_ERC721Gateway is iOVM_ERC721Gateway, OVM_CrossDomainEnabled {

    /********************************
     * External Contract References *
     ********************************/

    address public originalToken;
    address public depositedToken;

    /***************
     * Constructor *
     ***************/

    /**
     * @param _originalToken ERC721 address this gateway is deposits funds for
     * @param _depositedToken iOVM_DepositedERC721-compatible address on the chain being deposited into.
     * @param _messenger messenger address being used for cross-chain communications.
     */
    constructor(
        address _originalToken,
        address _depositedToken,
        address _messenger
    )
        OVM_CrossDomainEnabled(_messenger)
    {
        originalToken = _originalToken;
        depositedToken = _depositedToken;
    }

    /********************************
     * Overridable Accounting logic *
     ********************************/

    // Default gas value which can be overridden if more complex logic runs on L2.
    uint32 public DEFAULT_FINALIZE_DEPOSIT_GAS = 1200000;

    /**
     * @dev Core logic to be performed when a withdrawal is finalized.
     * In most cases, this will simply send locked funds to the withdrawer.
     *
     * param _to Address being withdrawn to.
     * param _tokenId Token being withdrawn.
     */
    function _handleFinalizeWithdrawal(
        address, // _to,
        uint256 // _tokenId
    )
        internal
        virtual
    {
        revert("Implement me in child contracts");
    }

    /**
     * @dev Core logic to be performed when a deposit is initiated.
     * In most cases, this will simply send the token to the Gateway contract.
     *
     * param _from Address being deposited from.
     * param _to Address being deposited into on the other side.
     * param _tokenId ERC721 being deposited.
     */
    function _handleInitiateDeposit(
        address, // _from,
        address, // _to,
        uint256 // _tokenId
    )
        internal
        virtual
    {
        revert("Implement me in child contracts");
    }

    /**
     * @dev Overridable getter for the gas limit on the other side, in the case it may be
     * dynamic, and the above public constant does not suffice.
     *
     */

    function getFinalizeDepositGas()
        public
        view
        returns(
            uint32
        )
    {
        return DEFAULT_FINALIZE_DEPOSIT_GAS;
    }

    /**************
     * Depositing *
     **************/

    /**
     * @dev deposit an ERC721 to the caller's balance on the other side
     * @param _tokenId ERC721 token to deposit
     */
    function deposit(
        uint _tokenId
    )
        public
        override
    {
        _initiateDeposit(msg.sender, msg.sender, _tokenId);
    }

    /**
     * @dev deposit an ERC721 to a recipient's balance on the other side
     * @param _to address to receive the ERC721 token
     * @param _tokenId ERC721 token to deposit
     */
    function depositTo(
        address _to,
        uint _tokenId
    )
        public
        override
    {
        _initiateDeposit(msg.sender, _to, _tokenId);
    }

    /**
     * @dev Performs the logic for deposits by informing the Deposited Token
     * contract on the other side of the deposit and calling a handler to lock the funds. (e.g. transferFrom)
     *
     * @param _from Account to pull the deposit from on L1
     * @param _to Account to give the deposit to on L2
     * @param _tokenId ERC721 token to deposit
     */
    function _initiateDeposit(
        address _from,
        address _to,
        uint _tokenId
    )
        internal
    {
        // Call our deposit accounting handler implemented by child contracts.
        _handleInitiateDeposit(
            _from,
            _to,
            _tokenId
        );

        // Construct calldata for depositedERC721.finalizeDeposit(_to, _tokenId, _tokenURI)
        bytes memory data = abi.encodeWithSelector(
            iOVM_DepositedERC721.finalizeDeposit.selector,
            _to,
            _tokenId,
            IERC721Metadata(originalToken).tokenURI(_tokenId)
        );

        // Send calldata into L2
        sendCrossDomainMessage(
            depositedToken,
            data,
            getFinalizeDepositGas()
        );

        emit DepositInitiated(_from, _to, _tokenId);
    }

    /*************************
     * Cross-chain Functions *
     *************************/

    /**
     * @dev Complete a withdrawal the other side, and credit the ERC721 token to the
     * recipient.
     * This call will fail if the initialized withdrawal from has not been finalized.
     *
     * @param _to L1 address to credit the withdrawal to
     * @param _tokenId ERC721 token to withdraw
     */
    function finalizeWithdrawal(
        address _to,
        uint _tokenId
    )
        external
        override
        onlyFromCrossDomainAccount(depositedToken)
    {
        // Call our withdrawal accounting handler implemented by child contracts.
        _handleFinalizeWithdrawal(
            _to,
            _tokenId
        );

        emit WithdrawalFinalized(_to, _tokenId);
    }
}
