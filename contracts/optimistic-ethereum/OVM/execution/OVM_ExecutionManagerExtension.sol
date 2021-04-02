// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

/* Contract Imports */
import { OVM_ExecutionManager } from "./OVM_ExecutionManager.sol";

contract OVM_ExecutionManagerExtention is OVM_ExecutionManager {
    /*****************************
     * L2-only Helper Functions *
     *****************************/

    /**
     * Unreachable helper function for simulating eth_calls with an OVM message context.
     * This function will throw an exception in all cases other than when used as a custom entrypoint in L2 Geth to simulate eth_call.
     * @param _transaction the message transaction to simulate.
     * @param _from the OVM account the simulated call should be from.
     */
    function simulateMessage(
        Lib_OVMCodec.Transaction memory _transaction,
        address _from,
        iOVM_StateManager _ovmStateManager
    )
        external
        returns (
            bool,
            bytes memory
        )
    {
        // Prevent this call from having any effect unless in a custom-set VM frame
        require(msg.sender == address(0));

        ovmStateManager = _ovmStateManager;
        _initContext(_transaction);

        messageRecord.nuisanceGasLeft = uint(-1);
        messageContext.ovmADDRESS = _transaction.entrypoint;
        messageContext.ovmCALLER = _from;

        return _transaction.entrypoint.call{gas: _transaction.gasLimit}(_transaction.data);
    }
}