// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

/* Library Imports */
import { Lib_OVMCodec } from "../../libraries/codec/Lib_OVMCodec.sol";
import { Lib_AddressResolver } from "../../libraries/resolver/Lib_AddressResolver.sol";
import { Lib_MerkleUtils } from "../../libraries/utils/Lib_MerkleUtils.sol";
import { Lib_RingBuffer, iRingBufferOverwriter } from "../../libraries/utils/Lib_RingBuffer.sol";

/* Interface Imports */
import { iOVM_FraudVerifier } from "../../iOVM/verification/iOVM_FraudVerifier.sol";
import { iOVM_StateCommitmentChain } from "../../iOVM/chain/iOVM_StateCommitmentChain.sol";
import { iOVM_CanonicalTransactionChain } from "../../iOVM/chain/iOVM_CanonicalTransactionChain.sol";
import { iOVM_BondManager } from "../../iOVM/verification/iOVM_BondManager.sol";
import '@openzeppelin/contracts/math/SafeMath.sol';

/**
 * @title OVM_StateCommitmentChain
 */
contract OVM_StateCommitmentChain is iOVM_StateCommitmentChain, iRingBufferOverwriter, Lib_AddressResolver {
    using Lib_RingBuffer for Lib_RingBuffer.RingBuffer;


    /*************
     * Constants *
     *************/

    uint256 public FRAUD_PROOF_WINDOW;
    uint256 public SEQUENCER_PUBLISH_WINDOW;


    /*************
     * Variables *
     *************/

    uint256 internal lastDeletableIndex;
    uint256 internal lastDeletableTimestamp;
    Lib_RingBuffer.RingBuffer internal batches;


    /***************
     * Constructor *
     ***************/

    /**
     * @param _libAddressManager Address of the Address Manager.
     */
    constructor(
        address _libAddressManager,
        uint256 _fraudProofWindow,
        uint256 _sequencerPublishWindow
    ) Lib_AddressResolver(_libAddressManager) {
        FRAUD_PROOF_WINDOW = _fraudProofWindow;
        SEQUENCER_PUBLISH_WINDOW = _sequencerPublishWindow;
    }


    /********************
     * Public Functions *
     ********************/

    /**
     * @inheritdoc iOVM_StateCommitmentChain
     */
    function init()
        override
        public
    {
        batches.init(
            16,
            Lib_OVMCodec.RING_BUFFER_SCC_BATCHES,
            iRingBufferOverwriter(address(this))
        );
    }

    /**
     * @inheritdoc iOVM_StateCommitmentChain
     */
    function getTotalElements()
        override
        public
        view
        returns (
            uint256 _totalElements
        )
    {
        (uint40 totalElements, ) = _getBatchExtraData();
        return uint256(totalElements);
    }

    /**
     * @inheritdoc iOVM_StateCommitmentChain
     */
    function getTotalBatches()
        override
        public
        view
        returns (
            uint256 _totalBatches
        )
    {
        return uint256(batches.getLength());
    }

    /**
     * @inheritdoc iOVM_StateCommitmentChain
     */
    function getLastSequencerTimestamp()
        override
        public
        view
        returns (
            uint256 _lastSequencerTimestamp
        )
    {
        (, uint40 lastSequencerTimestamp) = _getBatchExtraData();
        return uint256(lastSequencerTimestamp);
    }

    /**
     * @inheritdoc iOVM_StateCommitmentChain
     */
    function appendStateBatch(
        bytes32[] memory _batch,
        uint256 _shouldStartAtElement
    )
        override
        public
    {
        // Fail fast in to make sure our batch roots aren't accidentally made fraudulent by the
        // publication of batches by some other user.
        require(
            _shouldStartAtElement == getTotalElements(),
            "Actual batch start index does not match expected start index."
        );

        // Proposers must have previously staked at the BondManager
        require(
            iOVM_BondManager(resolve("OVM_BondManager")).isCollateralized(msg.sender),
            "Proposer does not have enough collateral posted"
        );

        require(
            _batch.length > 0,
            "Cannot submit an empty state batch."
        );

        require(
            getTotalElements() + _batch.length <= iOVM_CanonicalTransactionChain(resolve("OVM_CanonicalTransactionChain")).getTotalElements(),
            "Number of state roots cannot exceed the number of canonical transactions."
        );

        // Pass the block's timestamp and the publisher of the data
        // to be used in the fraud proofs
        _appendBatch(
            _batch,
            abi.encode(block.timestamp, msg.sender)
        );
    }

    /**
     * @inheritdoc iOVM_StateCommitmentChain
     */
    function deleteStateBatch(
        Lib_OVMCodec.ChainBatchHeader memory _batchHeader
    )
        override
        public
    {
        require(
            msg.sender == resolve("OVM_FraudVerifier"),
            "State batches can only be deleted by the OVM_FraudVerifier."
        );

        require(
            _isValidBatchHeader(_batchHeader),
            "Invalid batch header."
        );

        require(
            insideFraudProofWindow(_batchHeader),
            "State batches can only be deleted within the fraud proof window."
        );

        _deleteBatch(_batchHeader);
    }

    /**
     * @inheritdoc iOVM_StateCommitmentChain
     */
    function verifyStateCommitment(
        bytes32 _element,
        Lib_OVMCodec.ChainBatchHeader memory _batchHeader,
        Lib_OVMCodec.ChainInclusionProof memory _proof
    )
        override
        public
        view
        returns (
            bool
        )
    {
        require(
            _isValidBatchHeader(_batchHeader),
            "Invalid batch header."
        );

        require(
            Lib_MerkleUtils.verify(
                _batchHeader.batchRoot,
                abi.encodePacked(_element),
                _proof.index,
                _proof.siblings
            ),
            "Invalid inclusion proof."
        );

        return true;
    }

    /**
     * @inheritdoc iOVM_StateCommitmentChain
     */
    function insideFraudProofWindow(
        Lib_OVMCodec.ChainBatchHeader memory _batchHeader
    )
        override
        public
        view
        returns (
            bool _inside
        )
    {
        (uint256 timestamp,) = abi.decode(
            _batchHeader.extraData,
            (uint256, address)
        );

        require(
            timestamp != 0,
            "Batch header timestamp cannot be zero"
        );
        return SafeMath.add(timestamp, FRAUD_PROOF_WINDOW) > block.timestamp;
    }

    /**
     * @inheritdoc iOVM_StateCommitmentChain
     */
    function setLastOverwritableIndex(
        Lib_OVMCodec.ChainBatchHeader memory _stateBatchHeader,
        Lib_OVMCodec.Transaction memory _transaction,
        Lib_OVMCodec.TransactionChainElement memory _txChainElement,
        Lib_OVMCodec.ChainBatchHeader memory _txBatchHeader,
        Lib_OVMCodec.ChainInclusionProof memory _txInclusionProof
    )
        override
        public
    {
        require(
            _isValidBatchHeader(_stateBatchHeader),
            "Invalid batch header."
        );

        require(
            insideFraudProofWindow(_stateBatchHeader) == false,
            "Batch header must be outside of fraud proof window to be overwritable."
        );

        require(
            _stateBatchHeader.batchIndex > lastDeletableIndex,
            "Batch index must be greater than last overwritable index."
        );

        require(
            iOVM_CanonicalTransactionChain(resolve("OVM_CanonicalTransactionChain")).verifyTransaction(
                _transaction,
                _txChainElement,
                _txBatchHeader,
                _txInclusionProof
            ),
            "Invalid transaction proof."
        );

        lastDeletableIndex = _stateBatchHeader.batchIndex;
        lastDeletableTimestamp = _transaction.timestamp;
    }

    /**
     * @inheritdoc iRingBufferOverwriter
     */
    function canOverwrite(
        bytes32 _id,
        uint256 _index
    )
        override
        public
        view
        returns (
            bool
        )
    {
        if (_id == Lib_OVMCodec.RING_BUFFER_CTC_QUEUE) {
            return iOVM_CanonicalTransactionChain(resolve("OVM_CanonicalTransactionChain")).getQueueElement(_index / 2).timestamp < lastDeletableTimestamp;
        } else {
            return _index < lastDeletableIndex;
        }
    }


    /**********************
     * Internal Functions *
     **********************/

    /**
     * Parses the batch context from the extra data.
     * @return Total number of elements submitted.
     * @return Timestamp of the last batch submitted by the sequencer.
     */
    function _getBatchExtraData()
        internal
        view
        returns (
            uint40,
            uint40
        )
    {
        bytes27 extraData = batches.getExtraData();

        uint40 totalElements;
        uint40 lastSequencerTimestamp;
        assembly {
            extraData              := shr(40, extraData)
            totalElements          :=         and(extraData, 0x000000000000000000000000000000000000000000000000000000FFFFFFFFFF)
            lastSequencerTimestamp := shr(40, and(extraData, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF0000000000))
        }

        return (
            totalElements,
            lastSequencerTimestamp
        );
    }

    /**
     * Encodes the batch context for the extra data.
     * @param _totalElements Total number of elements submitted.
     * @param _lastSequencerTimestamp Timestamp of the last batch submitted by the sequencer.
     * @return Encoded batch context.
     */
    function _makeBatchExtraData(
        uint40 _totalElements,
        uint40 _lastSequencerTimestamp
    )
        internal
        pure
        returns (
            bytes27
        )
    {
        bytes27 extraData;
        assembly {
            extraData := _totalElements
            extraData := or(extraData, shl(40, _lastSequencerTimestamp))
            extraData := shl(40, extraData)
        }

        return extraData;
    }

    /**
     * Appends a batch to the chain.
     * @param _batch Elements within the batch.
     * @param _extraData Any extra data to append to the batch.
     */
    function _appendBatch(
        bytes32[] memory _batch,
        bytes memory _extraData
    )
        internal
    {
        address sequencer = resolve("OVM_Sequencer");
        (uint40 totalElements, uint40 lastSequencerTimestamp) = _getBatchExtraData();

        if (msg.sender == sequencer) {
            lastSequencerTimestamp = uint40(block.timestamp);
        } else {
            // We keep track of the last batch submitted by the sequencer so there's a window in
            // which only the sequencer can publish state roots. A window like this just reduces
            // the chance of "system breaking" state roots being published while we're still in
            // testing mode. This window should be removed or significantly reduced in the future.
            require(
                lastSequencerTimestamp + SEQUENCER_PUBLISH_WINDOW < block.timestamp,
                "Cannot publish state roots within the sequencer publication window."
            );
        }

        bytes[] memory elements = new bytes[](_batch.length);
        for (uint256 i = 0; i < _batch.length; i++) {
            elements[i] = abi.encodePacked(_batch[i]);
        }

        Lib_OVMCodec.ChainBatchHeader memory batchHeader = Lib_OVMCodec.ChainBatchHeader({
            batchIndex: getTotalBatches(),
            batchRoot: Lib_MerkleUtils.getMerkleRoot(elements),
            batchSize: elements.length,
            prevTotalElements: totalElements,
            extraData: _extraData
        });

        emit StateBatchAppended(
            batchHeader.batchIndex,
            batchHeader.batchRoot,
            batchHeader.batchSize,
            batchHeader.prevTotalElements,
            batchHeader.extraData
        );

        batches.push(
            Lib_OVMCodec.hashBatchHeader(batchHeader),
            _makeBatchExtraData(
                uint40(batchHeader.prevTotalElements + batchHeader.batchSize),
                lastSequencerTimestamp
            )
        );
    }

    /**
     * Removes a batch and all subsequent batches from the chain.
     * @param _batchHeader Header of the batch to remove.
     */
    function _deleteBatch(
        Lib_OVMCodec.ChainBatchHeader memory _batchHeader
    )
        internal
    {
        require(
            _batchHeader.batchIndex < batches.getLength(),
            "Invalid batch index."
        );

        require(
            _isValidBatchHeader(_batchHeader),
            "Invalid batch header."
        );

        batches.deleteElementsAfterInclusive(
            uint40(_batchHeader.batchIndex),
            _makeBatchExtraData(
                uint40(_batchHeader.prevTotalElements),
                0
            )
        );

        emit StateBatchDeleted(
            _batchHeader.batchIndex,
            _batchHeader.batchRoot
        );
    }

    /**
     * Checks that a batch header matches the stored hash for the given index.
     * @param _batchHeader Batch header to validate.
     * @return Whether or not the header matches the stored one.
     */
    function _isValidBatchHeader(
        Lib_OVMCodec.ChainBatchHeader memory _batchHeader
    )
        internal
        view
        returns (
            bool
        )
    {
        return Lib_OVMCodec.hashBatchHeader(_batchHeader) == batches.get(uint40(_batchHeader.batchIndex));
    }
}
