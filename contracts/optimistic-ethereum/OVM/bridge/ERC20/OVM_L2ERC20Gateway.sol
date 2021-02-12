// SPDX-License-Identifier: MIT
pragma solidity >0.5.0 <0.8.0;
pragma experimental ABIEncoderV2;

/* Interface Imports */
import { iOVM_L2ERC20Gateway } from "../../../iOVM/bridge/ERC20/iOVM_L2ERC20Gateway.sol";
import { iOVM_L1ERC20Gateway } from "../../../iOVM/bridge/ERC20/iOVM_L1ERC20Gateway.sol";
import { iOVM_L2CrossDomainMessenger } from "../../../iOVM/bridge/iOVM_L2CrossDomainMessenger.sol";


import { OVM_CrossChainEnabled } from "../OVM_CrossChainEnabled.sol";
import { ERC20 } from "./tempERC20.sol";

/**
 * @title OVM_L2ERC20Gateway
 * @dev The L2 ERC20 Gateway is an ERC20 implementation which represents L1 assets deposited into L2.
 * This contract mints new tokens when it hears about deposits into the L1 ERC20 gateway.
 * This contract also burns the tokens intended for withdrawal, informing the L1 gateway to release L1 funds.
 *
 * Compiler used: optimistic-solc
 * Runtime target: OVM
 */
contract OVM_L2ERC20Gateway is iOVM_L2ERC20Gateway, ERC20, OVM_CrossChainEnabled {
    
    /******************
     * Contract Events*
     ******************/

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
     * @param _name L2 ERC20 name
     * @param _decimalUnits L2 ERC20 decimalUnits
     */
    constructor(
        iOVM_L2CrossDomainMessenger _l2CrossDomainMessenger,
        string memory _name,
        uint8 _decimalUnits
    )
        public
        OVM_CrossChainEnabled(_l2CrossDomainMessenger)
        ERC20(0, _name, _decimalUnits)
    {}

    // Should we be inheriting this initialization logic?
    /**
     * @dev Initialize this gateway with the L1 gateway address
     * The assumed flow is that this contract is deployed, then the L1 gateway,
     * then init is called on L2.
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
        _burn(msg.sender, _amount);

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
            8999999 // TODO: meter and set with some buffer (actually I think its currently unused in this direction)
        );

        emit WithdrawalInitiated(msg.sender, _to, _amount);
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
        _mint(_to, _amount);
        emit DepositFinalized(_to, _amount);
    }
}