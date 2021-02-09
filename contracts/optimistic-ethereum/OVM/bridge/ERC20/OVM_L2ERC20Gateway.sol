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
 */
contract OVM_L2ERC20Gateway is iOVM_L2ERC20Gateway, ERC20, OVM_CrossChainEnabled {
    event Initialized(iOVM_L1ERC20Gateway _l1ERC20Gateway);

    iOVM_L1ERC20Gateway l1ERC20Gateway;

    constructor(
        iOVM_L2CrossDomainMessenger l2CrossDomainMessenger,
        string memory _name,
        uint8 _decimalUnits
    )
        public
        OVM_CrossChainEnabled(l2CrossDomainMessenger)
        ERC20(0, _name, _decimalUnits)
    { }

    // Should we be inheriting this initialization logic?
    function init(
        iOVM_L1ERC20Gateway _l1ERC20Gateway
    ) public {
        require(address(l1ERC20Gateway) == address(0), "Contract has already been initialized");
        emit Initialized(l1ERC20Gateway);
        l1ERC20Gateway = _l1ERC20Gateway;
    }

    modifier onlyInitialized() {
        require(address(l1ERC20Gateway) != address(0), "Contract has not yet been initialized");
        _;
    }

    /**
     * @dev initiate a withdraw of some ERC20 to the caller's account on L1
     * @param _amount Amount of the ERC20 to withdraw
     */
    function withdraw(uint _amount) external override onlyInitialized() {
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

    function _initiateWithdrawal(address _to, uint _amount) internal {
        _burn(msg.sender, _amount);

         bytes memory data = abi.encodeWithSelector(
            iOVM_L1ERC20Gateway.finalizeWithdrawal.selector,
            _to,
            _amount
        );

        sendCrossDomainMessage(
            address(l1ERC20Gateway),
            data,
            420069 // TODO: meter and set with some buffer (actually I think its currently unused in this direction)
        );

        emit WithdrawalInitiated(msg.sender, _to, _amount);
    }

    /**
     * @dev Completes a deposit from L1 to L2, and credits funds to the recipient's balance of this 
     * L2 ERC20 token. 
     * This call will fail if it did not originate from a corresponding deposit in OVM_L1ERC20Gateway. 
     *
     * @param _to Address to receive the withdrawal at
     * @param _amount Amount of the ERC20 to withdraw
     */
    function finalizeDeposit(address _to, uint _amount) external override onlyInitialized()
        onlyFromCrossChainContract(address(l1ERC20Gateway))
    {
        _mint(_to, _amount);
        emit DepositFinalized(_to, _amount);
    }
}