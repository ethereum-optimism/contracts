// SPDX-License-Identifier: MIT
// @unsupported: ovm
pragma solidity >0.5.0 <0.8.0;
pragma experimental ABIEncoderV2;

/* Interface Imports */
import { iOVM_L1ETHGateway } from "../../../iOVM/bridge/tokens/iOVM_L1ETHGateway.sol";
import { iOVM_L2DepositedERC20 } from "../../../iOVM/bridge/tokens/iOVM_L2DepositedERC20.sol";
import { iOVM_ERC20 } from "../../../iOVM/precompiles/iOVM_ERC20.sol";

/* Library Imports */
import { OVM_CrossDomainEnabled } from "../../../libraries/bridge/OVM_CrossDomainEnabled.sol";
import { Lib_AddressResolver } from "../../../libraries/resolver/Lib_AddressResolver.sol";

import { Abs_L1TokenGateway } from "./Abs_L1TokenGateway.sol";

/**
 * @title OVM_L1ETHGateway
 * @dev The L1 ETH Gateway is a contract which stores deposited ETH that is in use on L2.
 *
 * Compiler used: solc
 * Runtime target: EVM
 */
contract OVM_L1ETHGateway is iOVM_L1ETHGateway, Abs_L1TokenGateway, Lib_AddressResolver {


    function _handleFinalizeWithdrawal(
        address _to,
        uint256 _amount
    )
        internal
        override
    {
        _safeTransferETH(
            _to,
            _amount
        );
    }

    function _handleInitiateDeposit(
        address _from,
        address _to,
        uint256 _amount
    )
        internal
        override
    {
        require(msg.value == _amount, "deposit() _value input does not match msg.value");
    }


    /***************
     * Constructor *
     ***************/

    /**
     * @param _libAddressManager Address manager for this OE deployment
     */
    constructor(
        address _libAddressManager,
        address _l2DepositedERC20
    )
        Abs_L1TokenGateway(
            _l2DepositedERC20,
            address(0) // overridden in constructor code
        )
        Lib_AddressResolver(_libAddressManager)
    {
        messenger = resolve("Proxy__OVM_L1CrossDomainMessenger"); // we have to override Abs_L1TokenGateway constructor setting because resolve() is not yet accessible
    }

    /**************
     * Depositing *
     **************/

    /**
     * @dev deposit an amount of the ERC20 to the caller's balance on L2
     */
    function deposit() 
        external
        override
        payable
    {
        deposit(msg.value);
    }

    /**
     * @dev deposit an amount of ERC20 to a recipients's balance on L2
     * @param _to L2 address to credit the withdrawal to
     */
    function depositTo(
        address _to
    )
        external
        override
        payable
    {
        depositTo(_to, msg.value);
    }

    /**
     * @dev Internal accounting function for moving around L1 ETH.
     *
     * @param _to L1 address to transfer ETH to
     * @param _value Amount of ETH to send to
     */
    function _safeTransferETH(
        address _to,
        uint256 _value
    )
        internal
    {
        (bool success, ) = _to.call{value: _value}(new bytes(0));
        require(success, 'TransferHelper::safeTransferETH: ETH transfer failed');
    }

    /**
     * @dev Prevent users from sending ETH directly to this contract without calling deposit
     */
    receive()
        external
        payable
    {
        revert("Deposits must be initiated via deposit() or depositTo()");
    }
}
