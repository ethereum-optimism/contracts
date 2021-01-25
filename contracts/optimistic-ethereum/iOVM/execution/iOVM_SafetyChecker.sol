// SPDX-License-Identifier: MIT
pragma solidity >0.5.0 <0.8.0;

/**
 * @title iOVM_SafetyChecker
 */
interface iOVM_SafetyChecker {

    /********************
     * Public Functions *
     ********************/

    /**
     * Returns whether or not all of the provided bytecode is safe.
     * @param _bytecode The bytecode to safety check.
     * @return `true` if the bytecode is safe, `false` otherwise.
     */
    function isBytecodeSafe(
        bytes calldata _bytecode
    )
        external
        view
        returns (
            bool
        );
}
