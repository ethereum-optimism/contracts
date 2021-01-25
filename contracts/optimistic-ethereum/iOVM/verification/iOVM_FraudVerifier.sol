// SPDX-License-Identifier: MIT
pragma solidity >0.5.0 <0.8.0;
pragma experimental ABIEncoderV2;

/* Library Imports */
import { Lib_OVMCodec } from "../../libraries/codec/Lib_OVMCodec.sol";

/* Interface Imports */
import { iOVM_StateTransitioner } from "./iOVM_StateTransitioner.sol";

/**
 * @title iOVM_FraudVerifier
 */
interface iOVM_FraudVerifier {

    /**********
     * Events *
     **********/

    event FraudProofInitialized(
        bytes32 _preStateRoot,
        uint256 _preStateRootIndex,
        bytes32 _transactionHash,
        address _who
    );

    event FraudProofFinalized(
        bytes32 _preStateRoot,
        uint256 _preStateRootIndex,
        bytes32 _transactionHash,
        address _who
    );


    /********************
     * Public Functions *
     ********************/

    /**
     * Retrieves the state transitioner for a given root.
     * @param _preStateRoot State root to query a transitioner for.
     * @return Corresponding state transitioner contract.
     */
    function getStateTransitioner(
        bytes32 _preStateRoot,
        bytes32 _txHash
    )
        external
        view
        returns (
            iOVM_StateTransitioner
        );

    /**
     * Begins the fraud verification process.
     * @param _preStateRoot State root before the fraudulent transaction.
     * @param _preStateRootBatchHeader Batch header for the provided pre-state root.
     * @param _preStateRootProof Inclusion proof for the provided pre-state root.
     * @param _transaction OVM transaction claimed to be fraudulent.
     * @param _txChainElement OVM transaction chain element.
     * @param _transactionBatchHeader Batch header for the provided transaction.
     * @param _transactionProof Inclusion proof for the provided transaction.
     */
    function initializeFraudVerification(
        bytes32 _preStateRoot,
        Lib_OVMCodec.ChainBatchHeader calldata _preStateRootBatchHeader,
        Lib_OVMCodec.ChainInclusionProof calldata _preStateRootProof,
        Lib_OVMCodec.Transaction calldata _transaction,
        Lib_OVMCodec.TransactionChainElement calldata _txChainElement,
        Lib_OVMCodec.ChainBatchHeader calldata _transactionBatchHeader,
        Lib_OVMCodec.ChainInclusionProof calldata _transactionProof
    )
        external;

    /**
     * Finalizes the fraud verification process.
     * @param _preStateRoot State root before the fraudulent transaction.
     * @param _preStateRootBatchHeader Batch header for the provided pre-state root.
     * @param _preStateRootProof Inclusion proof for the provided pre-state root.
     * @param _txHash The transaction for the state root
     * @param _postStateRoot State root after the fraudulent transaction.
     * @param _postStateRootBatchHeader Batch header for the provided post-state root.
     * @param _postStateRootProof Inclusion proof for the provided post-state root.
     */
    function finalizeFraudVerification(
        bytes32 _preStateRoot,
        Lib_OVMCodec.ChainBatchHeader calldata _preStateRootBatchHeader,
        Lib_OVMCodec.ChainInclusionProof calldata _preStateRootProof,
        bytes32 _txHash,
        bytes32 _postStateRoot,
        Lib_OVMCodec.ChainBatchHeader calldata _postStateRootBatchHeader,
        Lib_OVMCodec.ChainInclusionProof calldata _postStateRootProof
    )
        external;
}
