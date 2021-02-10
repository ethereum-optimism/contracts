// SPDX-License-Identifier: MIT
pragma solidity >0.5.0 <0.8.0;
pragma experimental ABIEncoderV2;

/* Interface Imports */
import { iOVM_L1ERC20Gateway } from "../../../iOVM/bridge/ERC20/iOVM_L1ERC20Gateway.sol";
import { iOVM_L2ERC20Gateway } from "../../../iOVM/bridge/ERC20/iOVM_L2ERC20Gateway.sol";
import { iAbs_BaseCrossDomainMessenger } from "../../../iOVM/bridge/iAbs_BaseCrossDomainMessenger.sol";
import { iOVM_ERC20 } from "../../../iOVM/precompiles/iOVM_ERC20.sol";
import { OVM_CrossChainEnabled } from "../OVM_CrossChainEnabled.sol";

/**
 * @title OVM_L1ERC20Gateway
 */
contract OVM_L1ERC20Gateway is iOVM_L1ERC20Gateway, OVM_CrossChainEnabled {

    iOVM_ERC20 public l1ERC20;
    address public l2ERC20Gateway;

    constructor(
        iOVM_ERC20 _l1ERC20,
        address _l2ERC20Gateway,
        iAbs_BaseCrossDomainMessenger _messenger 
    )
        OVM_CrossChainEnabled(_messenger)
        public
    {
        l1ERC20 = _l1ERC20;
        l2ERC20Gateway = _l2ERC20Gateway;
    }

    /**
     * @dev deposit an amount of the ERC20 to the caller's balance on L2
     * @param _amount Amount of the ERC20 to deposit
     */
    function deposit(uint _amount) external override {
        _initiateDeposit(msg.sender, msg.sender, _amount);
    }
    /**
     * @dev deposit an amount of ERC20 to a recipients's balance on L2
     * @param _to L2 address to credit the withdrawal to
     * @param _amount Amount of the ERC20 to deposit
     */
    function depositTo(address _to, uint _amount) external override {
        _initiateDeposit(msg.sender, _to, _amount);
    }

    function _initiateDeposit(
        address _from,
        address _to,
        uint _amount
    ) internal {
        l1ERC20.transferFrom(
            _from,
            _to,
            _amount
        );

        bytes memory data = abi.encodeWithSelector(
            iOVM_L2ERC20Gateway.finalizeDeposit.selector,
            _to,
            _amount
        );

        sendCrossDomainMessage(
            l2ERC20Gateway,
            data,
            420069 // TODO: meter and set with some buffer
        );

        emit DepositInitiated(_from, _to, _amount);
    }

    /**
     * @dev Complete a withdrawal from L2 to L1, and credit funds to the recipient's balance of the 
     * L1 ERC20 token. 
     * This call will fail if the initialized withdrawal from L2 has not been finalized. 
     *
     * @param _to L1 address to credit the withdrawal to
     * @param _amount Amount of the ERC20 to withdraw
     */
    function finalizeWithdrawal(address _to, uint _amount) external override 
        onlyFromCrossDomainAccount(l2ERC20Gateway) 
    {
        l1ERC20.transfer(_to, _amount);

        emit WithdrawalFinalized(_to, _amount);
    } 
}