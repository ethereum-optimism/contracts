// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

/* Library Imports */
import { Lib_OVMCodec } from "../../libraries/codec/Lib_OVMCodec.sol";

/**
 * @title iOVM_BaseChain
 */
interface iOVM_BaseChain {

    /*************************************
     * Public Functions: Batch Retrieval *
     *************************************/

    function getTotalElements() external view returns (uint256 _totalElements);
    function getTotalBatches() external view returns (uint256 _totalBatches);


    /****************************************
     * Public Functions: Batch Verification *
     ****************************************/

    function verifyElement(
        bytes memory _element,
        Lib_OVMCodec.ChainBatchHeader memory _batchHeader,
        Lib_OVMCodec.ChainInclusionProof memory _proof
    ) external view returns (bool _verified);
}
