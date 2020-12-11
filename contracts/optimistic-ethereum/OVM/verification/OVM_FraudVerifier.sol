// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

/* Library Imports */
import { Lib_OVMCodec } from "../../libraries/codec/Lib_OVMCodec.sol";

/* Interface Imports */
import { iOVM_FraudVerifier } from "../../iOVM/verification/iOVM_FraudVerifier.sol";
import { iOVM_StateTransitioner } from "../../iOVM/verification/iOVM_StateTransitioner.sol";
import { iOVM_StateTransitionerFactory } from "../../iOVM/verification/iOVM_StateTransitionerFactory.sol";
import { iOVM_BondManager } from "../../iOVM/verification/iOVM_BondManager.sol";
import { iOVM_ExecutionManager } from "../../iOVM/execution/iOVM_ExecutionManager.sol";
import { iOVM_StateManagerFactory } from "../../iOVM/execution/iOVM_StateManagerFactory.sol";
import { iOVM_StateCommitmentChain } from "../../iOVM/chain/iOVM_StateCommitmentChain.sol";
import { iOVM_CanonicalTransactionChain } from "../../iOVM/chain/iOVM_CanonicalTransactionChain.sol";

/* Contract Imports */
import { OVM_FraudContributor } from "./OVM_FraudContributor.sol";
import { OVM_AddressResolver } from "../resolver/OVM_AddressResolver.sol";

contract OVM_FraudVerifier is OVM_AddressResolver, OVM_FraudContributor, iOVM_FraudVerifier {

    /*******************************************
     * Contract Variables: Internal Accounting *
     *******************************************/

    mapping (bytes32 => iOVM_StateTransitioner) internal transitioners;


    /***************
     * Constructor *
     ***************/

    /**
     * @param _ovmAddressManager Address of the Address Manager.
     */
    constructor(
        address _ovmAddressManager
    )
        OVM_AddressResolver(_ovmAddressManager)
    {}


    /***************************************
     * Public Functions: Transition Status *
     ***************************************/

    /**
     * Retrieves the state transitioner for a given root.
     * @param _preStateRoot State root to query a transitioner for.
     * @return _transitioner Corresponding state transitioner contract.
     */
    function getStateTransitioner(
        bytes32 _preStateRoot,
        bytes32 _txHash
    )
        override
        public
        view
        returns (
            iOVM_StateTransitioner _transitioner
        )
    {
        return transitioners[keccak256(abi.encodePacked(_preStateRoot, _txHash))];
    }


    /****************************************
     * Public Functions: Fraud Verification *
     ****************************************/

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
        Lib_OVMCodec.ChainBatchHeader memory _preStateRootBatchHeader,
        Lib_OVMCodec.ChainInclusionProof memory _preStateRootProof,
        Lib_OVMCodec.Transaction memory _transaction,
        Lib_OVMCodec.TransactionChainElement memory _txChainElement,
        Lib_OVMCodec.ChainBatchHeader memory _transactionBatchHeader,
        Lib_OVMCodec.ChainInclusionProof memory _transactionProof
    )
        override
        public
        contributesToFraudProof(_preStateRoot, Lib_OVMCodec.hashOVMTransaction(_transaction))
    {
        bytes32 _txHash = Lib_OVMCodec.hashOVMTransaction(_transaction);

        if (_hasStateTransitioner(_preStateRoot, _txHash)) {
            return;
        }

        iOVM_StateCommitmentChain ovmStateCommitmentChain = iOVM_StateCommitmentChain(resolve("OVM_StateCommitmentChain"));
        iOVM_CanonicalTransactionChain ovmCanonicalTransactionChain = iOVM_CanonicalTransactionChain(resolve("OVM_CanonicalTransactionChain"));

        require(
            ovmStateCommitmentChain.verifyStateCommitment(
                _preStateRoot,
                _preStateRootBatchHeader,
                _preStateRootProof
            ),
            "Invalid pre-state root inclusion proof."
        );

        require(
            ovmCanonicalTransactionChain.verifyTransaction(
                _transaction,
                _txChainElement,
                _transactionBatchHeader,
                _transactionProof
            ),
            "Invalid transaction inclusion proof."
        );

        require (
            _preStateRootBatchHeader.prevTotalElements + _preStateRootProof.index == _transactionBatchHeader.prevTotalElements + _transactionProof.index,
            "Pre-state root global index must equal to the transaction root global index."
        );

        deployTransitioner(_preStateRoot, _txHash);
    }

    // NB: Stack too deep :/
    function deployTransitioner(bytes32 _preStateRoot, bytes32 _txHash) private {
        transitioners[keccak256(abi.encodePacked(_preStateRoot, _txHash))] = iOVM_StateTransitionerFactory(
            resolve("OVM_StateTransitionerFactory")
        ).create(
            address(ovmAddressManager),
            _preStateRoot,
            _txHash
        );
    }

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
        Lib_OVMCodec.ChainBatchHeader memory _preStateRootBatchHeader,
        Lib_OVMCodec.ChainInclusionProof memory _preStateRootProof,
        bytes32 _txHash,
        bytes32 _postStateRoot,
        Lib_OVMCodec.ChainBatchHeader memory _postStateRootBatchHeader,
        Lib_OVMCodec.ChainInclusionProof memory _postStateRootProof
    )
        override
        public
        contributesToFraudProof(_preStateRoot, _txHash)
    {
        iOVM_StateTransitioner transitioner = getStateTransitioner(_preStateRoot, _txHash);
        iOVM_StateCommitmentChain ovmStateCommitmentChain = iOVM_StateCommitmentChain(resolve("OVM_StateCommitmentChain"));
        iOVM_BondManager ovmBondManager = iOVM_BondManager(resolve("OVM_BondManager"));

        require(
            transitioner.isComplete() == true,
            "State transition process must be completed prior to finalization."
        );

        require (
            _postStateRootBatchHeader.prevTotalElements + _postStateRootProof.index == _preStateRootBatchHeader.prevTotalElements + _preStateRootProof.index + 1,
            "Post-state root global index must equal to the pre state root global index plus one."
        );

        require(
            ovmStateCommitmentChain.verifyStateCommitment(
                _preStateRoot,
                _preStateRootBatchHeader,
                _preStateRootProof
            ),
            "Invalid pre-state root inclusion proof."
        );

        require(
            ovmStateCommitmentChain.verifyStateCommitment(
                _postStateRoot,
                _postStateRootBatchHeader,
                _postStateRootProof
            ),
            "Invalid post-state root inclusion proof."
        );

        // If the post state root did not match, then there was fraud and we should delete the batch
        require(
            _postStateRoot != transitioner.getPostStateRoot(),
            "State transition has not been proven fraudulent."
        );

        cancelStateTransition(_postStateRootBatchHeader, _preStateRoot);
    }

    // NB: Stack too deep :/
    function cancelStateTransition(
        Lib_OVMCodec.ChainBatchHeader memory _postStateRootBatchHeader,
        bytes32 _preStateRoot
    ) private {
        iOVM_StateCommitmentChain ovmStateCommitmentChain = iOVM_StateCommitmentChain(resolve("OVM_StateCommitmentChain"));
        iOVM_BondManager ovmBondManager = iOVM_BondManager(resolve("OVM_BondManager"));
        // delete the state batch
        ovmStateCommitmentChain.deleteStateBatch(
            _postStateRootBatchHeader
        );

        // Get the timestamp and publisher for that block
        (uint256 timestamp, address publisher) = abi.decode(_postStateRootBatchHeader.extraData, (uint256, address));

        // slash the bonds at the bond manager
        ovmBondManager.finalize(
            _preStateRoot,
            publisher,
            timestamp
        );
    }


    /************************************
     * Internal Functions: Verification *
     ************************************/

    /**
     * Checks whether a transitioner already exists for a given pre-state root.
     * @param _preStateRoot Pre-state root to check.
     * @return _exists Whether or not we already have a transitioner for the root.
     */
    function _hasStateTransitioner(
        bytes32 _preStateRoot,
        bytes32 _txHash
    )
        internal
        view
        returns (
            bool _exists
        )
    {
        return address(getStateTransitioner(_preStateRoot, _txHash)) != address(0);
    }
}
