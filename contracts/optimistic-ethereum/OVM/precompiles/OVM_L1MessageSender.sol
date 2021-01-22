// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

/* Interface Imports */
import { iOVM_L1MessageSender } from "../../iOVM/precompiles/iOVM_L1MessageSender.sol";
import { iOVM_ExecutionManager } from "../../iOVM/execution/iOVM_ExecutionManager.sol";

/**
 * @title OVM_L1MessageSender
 * @dev L2 CONTRACT (NOT COMPILED)
 * 
 * This contract is compiled by the standard Solidity compiler, but is written to be OVM safe.
 * It is a predeploy on Layer 2.
 *
 * The function of this contract is to return the L1 address which call 
 */
contract OVM_L1MessageSender is iOVM_L1MessageSender {

    /********************
     * Public Functions *
     ********************/

    /**
     * @return _l1MessageSender L1 message sender address (msg.sender).
     */
    function getL1MessageSender()
        override
        public
        view
        returns (
            address _l1MessageSender
        )
    {
        return iOVM_ExecutionManager(msg.sender).ovmL1TXORIGIN();
    }
}
