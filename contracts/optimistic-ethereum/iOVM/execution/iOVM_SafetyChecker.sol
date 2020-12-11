// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

/**
 * @title iOVM_SafetyChecker
 */
interface iOVM_SafetyChecker {

    /********************
     * Public Functions *
     ********************/

    function isBytecodeSafe(bytes calldata _bytecode) external view returns (bool);
}
