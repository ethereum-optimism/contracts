// SPDX-License-Identifier: MIT
pragma solidity >0.5.0 <0.8.0;
pragma experimental ABIEncoderV2;

/* Interface Imports */
import { iOVM_L2DepositedERC20 } from "../../../iOVM/bridge/tokens/iOVM_L2DepositedERC20.sol";
import { iOVM_L1ERC20Gateway } from "../../../iOVM/bridge/tokens/iOVM_L1ERC20Gateway.sol";

/* Library Imports */
import { OVM_CrossDomainEnabled } from "../../../libraries/bridge/OVM_CrossDomainEnabled.sol";

/**
 * @title OVM_L2DepositedERC20
 * @dev The L2 Deposited ERC20 is an ERC20 implementation which represents L1 assets deposited into L2.
 * This contract mints new tokens when it hears about deposits into the L1 ERC20 gateway.
 * This contract also burns the tokens intended for withdrawal, informing the L1 gateway to release L1 funds.
 *
 * Compiler used: optimistic-solc
 * Runtime target: OVM
 */
abstract contract Abs_L2DepositedERC20 is iOVM_L2DepositedERC20, OVM_CrossDomainEnabled {
    
    uint32 constant DEFAULT_FINALIZE_WITHDRAWAL_L1_GAS = 100000;

    /*******************
     * Contract Events *
     *******************/

    event Initialized(iOVM_L1ERC20Gateway _l1ERC20Gateway);

    /********************************
     * External Contract References *
     ********************************/

    iOVM_L1ERC20Gateway l1ERC20Gateway;

    /********************************
     * Constructor & Initialization *
     ********************************/

    /**
     * @param _l2CrossDomainMessenger L1 Messenger address being used for cross-chain communications.
     */
    constructor(
        address _l2CrossDomainMessenger
    )
        OVM_CrossDomainEnabled(_l2CrossDomainMessenger)
    {}

    /**
     * @dev Initialize this gateway with the L1 gateway address
     * The assumed flow is that this contract is deployed on L2, then the L1 
     * gateway is dpeloyed, and its address passed here to init.
     *
     * @param _l1ERC20Gateway Address of the corresponding L1 gateway deployed to the main chain
     */

    function init(
        iOVM_L1ERC20Gateway _l1ERC20Gateway
    )
        public
    {
        require(address(l1ERC20Gateway) == address(0), "Contract has already been initialized");

        l1ERC20Gateway = _l1ERC20Gateway;
        
        emit Initialized(l1ERC20Gateway);
    }

    /**********************
     * Function Modifiers *
     **********************/

    modifier onlyInitialized() {
        require(address(l1ERC20Gateway) != address(0), "Contract has not yet been initialized");
        _;
    }

    /***************
     * Withdrawing *
     ***************/

    /**
     * @dev initiate a withdraw of some ERC20 to the caller's account on L1
     * @param _amount Amount of the ERC20 to withdraw
     */
    function withdraw(
        uint _amount
    )
        external
        override
        onlyInitialized()
    {
        _initiateWithdrawal(msg.sender, _amount);
    }

    /**
     * @dev initiate a withdraw of some ERC20 to a recipient's account on L1
     * @param _to L1 adress to credit the withdrawal to
     * @param _amount Amount of the ERC20 to withdraw
     */
    function withdrawTo(address _to, uint _amount) external override onlyInitialized() {
        _initiateWithdrawal(_to, _amount);
    }

    /**
     * @dev Performs the logic for deposits by storing the ERC20 and informing the L2 ERC20 Gateway of the deposit.
     *
     * @param _to Account to give the withdrawal to on L1
     * @param _amount Amount of the ERC20 to withdraw
     */
    function _initiateWithdrawal(address _to, uint _amount) internal {
        // burn L2 funds so they can't be used more on L2
        _handleInitiateWithdrawal(_to, _amount);

        // Construct calldata for l1ERC20Gateway.finalizeWithdrawal(_to, _amount)
        bytes memory data = abi.encodeWithSelector(
            iOVM_L1ERC20Gateway.finalizeWithdrawal.selector,
            _to,
            _amount
        );

        // Send message up to L1 gateway
        sendCrossDomainMessage(
            address(l1ERC20Gateway),
            data,
            getFinalizeWithdrawalL1Gas()
        );

        emit WithdrawalInitiated(msg.sender, _to, _amount);
    }

    function getFinalizeWithdrawalL1Gas()
        public
        view
        virtual
        override
        returns(
            uint32
        )
    {
        return DEFAULT_FINALIZE_WITHDRAWAL_L1_GAS;
    }

    function _handleInitiateWithdrawal(
        address _to,
        uint _amount
    )
        internal
        virtual
    {
        revert("Accounting must be implemented by child contract.");
    }

    function _handleFinalizeDeposit(
        address _to,
        uint _amount
    )
        internal
        virtual
    {
        revert("Accounting must be implemented by child contract.");
    }

    /************************************
     * Cross-chain Function: Depositing *
     ************************************/

    /**
     * @dev Complete a deposit from L1 to L2, and credits funds to the recipient's balance of this 
     * L2 ERC20 token. 
     * This call will fail if it did not originate from a corresponding deposit in OVM_L1ERC20Gateway. 
     *
     * @param _to Address to receive the withdrawal at
     * @param _amount Amount of the ERC20 to withdraw
     */
    function finalizeDeposit(address _to, uint _amount) external override onlyInitialized()
        onlyFromCrossDomainAccount(address(l1ERC20Gateway))
    {
        _handleFinalizeDeposit(_to, _amount);
        emit DepositFinalized(_to, _amount);
    }
}