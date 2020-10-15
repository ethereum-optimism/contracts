// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

/* Library Imports */
import { Lib_OVMCodec } from "../../libraries/codec/Lib_OVMCodec.sol";
import { Lib_AddressResolver } from "../../libraries/resolver/Lib_AddressResolver.sol";

/* Interface Imports */
import { iOVM_FraudVerifier } from "../../iOVM/verification/iOVM_FraudVerifier.sol";
import { iOVM_StateTransitioner } from "../../iOVM/verification/iOVM_StateTransitioner.sol";
import { iOVM_StateTransitionerFactory } from "../../iOVM/verification/iOVM_StateTransitionerFactory.sol";
import { iOVM_ExecutionManager } from "../../iOVM/execution/iOVM_ExecutionManager.sol";
import { iOVM_StateManagerFactory } from "../../iOVM/execution/iOVM_StateManagerFactory.sol";
import { iOVM_StateCommitmentChain } from "../../iOVM/chain/iOVM_StateCommitmentChain.sol";
import { iOVM_CanonicalTransactionChain } from "../../iOVM/chain/iOVM_CanonicalTransactionChain.sol";

/* Contract Imports */
import { OVM_FraudContributor } from "./../OVM_FraudContributor.sol";
import { OVM_BondManager } from "./../OVM_BondManager.sol";

contract OVM_FraudVerifier is OVM_FraudContributor, iOVM_FraudVerifier, Lib_AddressResolver {

    /*******************************************
     * Contract Variables: Contract References *
     *******************************************/

    iOVM_StateCommitmentChain internal ovmStateCommitmentChain;
    iOVM_CanonicalTransactionChain internal ovmCanonicalTransactionChain;

    
    /*******************************************
     * Contract Variables: Internal Accounting *
     *******************************************/

    mapping (bytes32 => iOVM_StateTransitioner) internal transitioners;
    

    /***************
     * Constructor *
     ***************/

    /**
     * @param _libAddressManager Address of the Address Manager.
     */
    constructor(
        address _libAddressManager
    )
        Lib_AddressResolver(_libAddressManager)
    {
        ovmStateCommitmentChain = iOVM_StateCommitmentChain(resolve("OVM_StateCommitmentChain"));
        ovmCanonicalTransactionChain = iOVM_CanonicalTransactionChain(resolve("OVM_CanonicalTransactionChain"));
        ovmBondManager = OVM_BondManager(resolve("OVM_BondManager"));
    }


    /***************************************
     * Public Functions: Transition Status *
     ***************************************/

    /**
     * Retrieves the state transitioner for a given root.
     * @param _preStateRoot State root to query a transitioner for.
     * @return _transitioner Corresponding state transitioner contract.
     */
    function getStateTransitioner(
        bytes32 _preStateRoot
    )
        override
        public
        view
        returns (
            iOVM_StateTransitioner _transitioner
        )
    {
        return transitioners[_preStateRoot];
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
     * @param _transactionBatchHeader Batch header for the provided transaction.
     * @param _transactionProof Inclusion proof for the provided transaction.
     */
    function initializeFraudVerification(
        bytes32 _preStateRoot,
        Lib_OVMCodec.ChainBatchHeader memory _preStateRootBatchHeader,
        Lib_OVMCodec.ChainInclusionProof memory _preStateRootProof,
        Lib_OVMCodec.Transaction memory _transaction,
        Lib_OVMCodec.ChainBatchHeader memory _transactionBatchHeader,
        Lib_OVMCodec.ChainInclusionProof memory _transactionProof
    )
        override
        public
        contributesToFraudProof(_preStateRoot)
    {
        if (_hasStateTransitioner(_preStateRoot)) {
            return;
        }

        require(
            _verifyStateRoot(
                _preStateRoot,
                _preStateRootBatchHeader,
                _preStateRootProof
            ),
            "Invalid pre-state root inclusion proof."
        );

        require(
            _verifyTransaction(
                _transaction,
                _transactionBatchHeader,
                _transactionProof
            ),
            "Invalid transaction inclusion proof."
        );

        transitioners[_preStateRoot] = iOVM_StateTransitionerFactory(
            resolve("OVM_StateTransitionerFactory")
        ).create(
            address(libAddressManager),
            _preStateRootProof.index,
            _preStateRoot,
            Lib_OVMCodec.hashTransaction(_transaction)
        );
    }

    /**
     * Finalizes the fraud verification process.
     * @param _preStateRoot State root before the fraudulent transaction.
     * @param _preStateRootBatchHeader Batch header for the provided pre-state root.
     * @param _preStateRootProof Inclusion proof for the provided pre-state root.
     * @param _postStateRoot State root after the fraudulent transaction.
     * @param _postStateRootBatchHeader Batch header for the provided post-state root.
     * @param _postStateRootProof Inclusion proof for the provided post-state root.
     */
    function finalizeFraudVerification(
        bytes32 _preStateRoot,
        Lib_OVMCodec.ChainBatchHeader memory _preStateRootBatchHeader,
        Lib_OVMCodec.ChainInclusionProof memory _preStateRootProof,
        bytes32 _postStateRoot,
        Lib_OVMCodec.ChainBatchHeader memory _postStateRootBatchHeader,
        Lib_OVMCodec.ChainInclusionProof memory _postStateRootProof
    )
        override
        public
        contributesToFraudProof(_preStateRoot)
    {
        iOVM_StateTransitioner transitioner = transitioners[_preStateRoot];

        require(
            transitioner.isComplete() == true,
            "State transition process must be completed prior to finalization."
        );

        require(
            _postStateRootProof.index == _preStateRootProof.index + 1,
            "Invalid post-state root index."
        );

        require(
            _verifyStateRoot(
                _preStateRoot,
                _preStateRootBatchHeader,
                _preStateRootProof
            ),
            "Invalid pre-state root inclusion proof."
        );

        require(
            _verifyStateRoot(
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

        // delete the state batch
        ovmStateCommitmentChain.deleteStateBatch(
            _postStateRootBatchHeader
        );

        // Get the timestamp and publisher for that block
        (uint256 timestamp, address publisher) = abi.decode(_postStateRootBatchHeader.extraData, (uint256, address));

        // slash the bonds at the bond manager
        ovmBondManager.finalize(
            _preStateRoot,
            _postStateRootBatchHeader.batchIndex,
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
        bytes32 _preStateRoot
    )
        internal
        view
        returns (
            bool _exists
        )
    {
        return address(transitioners[_preStateRoot]) != address(0);
    }

    /**
     * Verifies inclusion of a state root.
     * @param _stateRoot State root to verify
     * @param _stateRootBatchHeader Batch header for the provided state root.
     * @param _stateRootProof Inclusion proof for the provided state root.
     * @return _verified Whether or not the root was included.
     */
    function _verifyStateRoot(
        bytes32 _stateRoot,
        Lib_OVMCodec.ChainBatchHeader memory _stateRootBatchHeader,
        Lib_OVMCodec.ChainInclusionProof memory _stateRootProof
    )
        internal
        view
        returns (
            bool _verified
        )
    {
        return ovmStateCommitmentChain.verifyElement(
            abi.encodePacked(_stateRoot),
            _stateRootBatchHeader,
            _stateRootProof
        );
    }

    /**
     * Verifies inclusion of a given transaction.
     * @param _transaction OVM transaction to verify.
     * @param _transactionBatchHeader Batch header for the provided transaction.
     * @param _transactionProof Inclusion proof for the provided transaction.
     * @return _verified Whether or not the transaction was included.
     */
    function _verifyTransaction(
        Lib_OVMCodec.Transaction memory _transaction,
        Lib_OVMCodec.ChainBatchHeader memory _transactionBatchHeader,
        Lib_OVMCodec.ChainInclusionProof memory _transactionProof
    )
        internal
        view
        returns (
            bool _verified
        )
    {
        return ovmCanonicalTransactionChain.verifyElement(
            Lib_OVMCodec.encodeTransaction(_transaction),
            _transactionBatchHeader,
            _transactionProof
        );
    }
}
