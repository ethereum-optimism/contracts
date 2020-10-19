// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

/* Interface Imports */
import { iOVM_BaseChain } from "./iOVM_BaseChain.sol";

/* Library Imports */
import { Lib_OVMCodec } from "../../libraries/codec/Lib_OVMCodec.sol";

/**
 * @title iOVM_StateCommitmentChain
 */
interface iOVM_StateCommitmentChain is iOVM_BaseChain {

    /****************************************
     * Public Functions: Batch Manipulation *
     ****************************************/

    function appendStateBatch(bytes32[] calldata _batch) external;
    function deleteStateBatch(Lib_OVMCodec.ChainBatchHeader memory _batchHeader) external;

    /**********************************
     * Public Functions: Batch Status *
     **********************************/


    function verifyStateCommitment(
        bytes32 _element,
        Lib_OVMCodec.ChainBatchHeader memory _batchHeader,
        Lib_OVMCodec.ChainInclusionProof memory _proof
    ) external view returns (bool _verified);
    function insideFraudProofWindow(Lib_OVMCodec.ChainBatchHeader memory _batchHeader) external view returns (bool _inside);
}
