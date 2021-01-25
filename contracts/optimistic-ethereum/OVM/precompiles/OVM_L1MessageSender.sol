// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

/* Interface Imports */
import { iOVM_L1MessageSender } from "../../iOVM/precompiles/iOVM_L1MessageSender.sol";
import { iOVM_ExecutionManager } from "../../iOVM/execution/iOVM_ExecutionManager.sol";

/**
 * @title OVM_L1MessageSender
 * @dev The L1MessageSender is a predeploy contract running on L2. During an L1 to L2 cross domain transaction
 * it returns the address of the L1 account (either an EOA or contract) which sent the message to L2 by calling
 * the Canonical Transaction Chain's `enqueue()` function.
 * 
 * This contract can be thought of as a getter for the ovmL1TXORIGIN operation in the Execution Manager. 
 * It is necessary to have this contract... @todo... this is WIP
 * The only reason it exists is that if you add +build ovm to a contract this becomes inaccessible,
 * because the above line would be turned into iOVM_EM(ovmCALLER).ovmL1TXORIGIN which would then not give you actual access to the EM.
 * 
 * Compiler used: solc
 * Runtime target: EVM
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
        // msg.sender is expected to be the Execution Manager
        return iOVM_ExecutionManager(msg.sender).ovmL1TXORIGIN();
    }
}
