// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

/* Interface Imports */
import { iOVM_StateManager } from "../../iOVM/execution/iOVM_StateManager.sol";
import { iOVM_StateManagerFactory } from "../../iOVM/execution/iOVM_StateManagerFactory.sol";

/* Contract Imports */
import { OVM_StateManager } from "./OVM_StateManager.sol";

/**
 * @title OVM_StateManagerFactory
 * @todo: header comment
 * 
 * This contract compiles to __
 * It is (only) deployed on Layer ...
 */
contract OVM_StateManagerFactory is iOVM_StateManagerFactory {

    /***************************************
     * Public Functions: Contract Creation *
     ***************************************/

    /**
     * Creates a new OVM_StateManager
     * @param _owner Owner of the created contract.
     * @return _ovmStateManager New OVM_StateManager instance.
     */
    function create(
        address _owner
    )
        override
        public
        returns (
            iOVM_StateManager _ovmStateManager
        )
    {
        return new OVM_StateManager(_owner);
    }
}
