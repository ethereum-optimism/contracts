// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

/* Library Imports */
import { Lib_RLPReader } from "../rlp/Lib_RLPReader.sol";
import { Lib_RLPWriter } from "../rlp/Lib_RLPWriter.sol";
import { Lib_BytesUtils } from "../utils/Lib_BytesUtils.sol";

/**
 * @title Lib_OVMCodec
 */
library Lib_OVMCodec {

    /*************
     * Constants *
     *************/

    bytes constant internal RLP_NULL_BYTES = hex'80';
    bytes constant internal NULL_BYTES = bytes('');
    bytes32 constant internal NULL_BYTES32 = bytes32('');
    bytes32 constant internal KECCAK256_RLP_NULL_BYTES = keccak256(RLP_NULL_BYTES);
    bytes32 constant internal KECCAK256_NULL_BYTES = keccak256(NULL_BYTES);

    // Ring buffer IDs
    bytes32 constant internal RING_BUFFER_SCC_BATCHES = keccak256("RING_BUFFER_SCC_BATCHES");
    bytes32 constant internal RING_BUFFER_CTC_BATCHES = keccak256("RING_BUFFER_CTC_BATCHES");
    bytes32 constant internal RING_BUFFER_CTC_QUEUE = keccak256("RING_BUFFER_CTC_QUEUE");


    /*********
     * Enums *
     *********/
    
    enum EOASignatureType {
        ETH_SIGNED_MESSAGE,
        EIP155_TRANSACTON,
        CREATE_EOA_TRANSACTION
    }

    enum QueueOrigin {
        SEQUENCER_QUEUE,
        L1TOL2_QUEUE
    }


    /***********
     * Structs *
     ***********/

    struct Account {
        uint256 nonce;
        uint256 balance;
        bytes32 storageRoot;
        bytes32 codeHash;
        address ethAddress;
        bool isFresh;
    }

    struct EVMAccount {
        uint256 nonce;
        uint256 balance;
        bytes32 storageRoot;
        bytes32 codeHash;
    }

    struct ChainBatchHeader {
        uint256 batchIndex;
        bytes32 batchRoot;
        uint256 batchSize;
        uint256 prevTotalElements;
        bytes extraData;
    }

    struct ChainInclusionProof {
        uint256 index;
        bytes32[] siblings;
    }

    struct Transaction {
        uint256 timestamp;
        uint256 blockNumber;
        QueueOrigin l1QueueOrigin;
        address l1TxOrigin;
        address entrypoint;
        uint256 gasLimit;
        bytes data;
    }

    struct TransactionChainElement {
        bool isSequenced;
        uint256 queueIndex;  // QUEUED TX ONLY
        uint256 timestamp;   // SEQUENCER TX ONLY
        uint256 blockNumber; // SEQUENCER TX ONLY
        bytes txData;        // SEQUENCER TX ONLY
    }

    struct QueueElement {
        bytes32 queueRoot;
        uint40 timestamp;
        uint40 blockNumber;
    }

    struct EOATransaction {
        address target;
        uint256 nonce;
        uint256 gasLimit;
        bytes data;
    }

    struct EIP155Transaction {
        uint256 nonce;
        uint256 gasPrice;
        uint256 gasLimit;
        address target;
        uint256 value;
        bytes data;
        uint256 chainId;
    }


    /*********************************************
     * Internal Functions: Encoding and Decoding *
     *********************************************/

    /**
     * Decodes an EOA transaction (i.e., native Ethereum RLP encoding).
     * @param _transaction Encoded EOA transaction.
     * @return _decoded Transaction decoded into a struct.
     */
    function decodeEOATransaction(
        bytes memory _transaction
    )
        internal
        pure
        returns (
            EOATransaction memory _decoded
        )
    {
        Lib_RLPReader.RLPItem[] memory decoded = Lib_RLPReader.readList(_transaction);

        return EOATransaction({
            nonce: Lib_RLPReader.readUint256(decoded[0]),
            gasLimit: Lib_RLPReader.readUint256(decoded[2]),
            target: Lib_RLPReader.readAddress(decoded[3]),
            data: Lib_RLPReader.readBytes(decoded[5])
        });
    }

    function rlpDecodeEIP155Transaction(
        bytes memory _transaction
    )
        internal
        pure
        returns (
            EIP155Transaction memory _decoded
        )
    {
        Lib_RLPReader.RLPItem[] memory decoded = Lib_RLPReader.readList(_transaction);

        return EIP155Transaction({
            nonce: Lib_RLPReader.readUint256(decoded[0]),
            gasPrice: Lib_RLPReader.readUint256(decoded[1]),
            gasLimit: Lib_RLPReader.readUint256(decoded[2]),
            target: Lib_RLPReader.readAddress(decoded[3]),
            value: Lib_RLPReader.readBytes(decoded[4]),
            data: Lib_RLPReader.readBytes(decoded[5]),
            chainId: Lib_RLPReader.readBytes(decoded[6])
        });
    }

    function decodeEIP155Transaction(
        bytes memory _transaction
    )
        internal
        pure
        returns (
            EIP155Transaction memory _decoded
        )
    {
        uint256 gasLimit = Lib_BytesUtils.toUint256(Lib_BytesUtils.slice(_transaction, 0, 3));
        uint256 gasPrice= Lib_BytesUtils.toUint256(Lib_BytesUtils.slice(msg.data, 3, 3));
        uint256 nonce = Lib_BytesUtils.toUint256(Lib_BytesUtils.slice(msg.data, 6, 3));
        address target = Lib_BytesUtils.toAddress(Lib_BytesUtils.slice(msg.data, 9, 20))


        return EIP155Transaction({
            nonce: Lib_RLPReader.readUint256(decoded[0]),
            gasPrice: Lib_RLPReader.readUint256(decoded[1]),
            gasLimit: Lib_RLPReader.readUint256(decoded[2]),
            target: Lib_RLPReader.readAddress(decoded[3]),
            value: Lib_RLPReader.readBytes(decoded[4]),
            data: Lib_RLPReader.readBytes(decoded[5]),
            chainId: Lib_RLPReader.readBytes(decoded[6])
        });
    }

    /**
     * Encodes an EOA transaction back into the original transaction.
     * @param _transaction EIP155transaction to encode.
     * @param _isEthSignedMessage Whether or not this was an eth signed message.
     * @return Encoded transaction.
     */
    function encodeEIP155Transaction(
        EIP155Transaction memory _transaction,
        bool _isEthSignedMessage
    )
        internal
        pure
        returns (
            bytes memory
        )
    {
        if (_isEthSignedMessage) {
            return abi.encode(
                _transaction.nonce,
                _transaction.gasLimit,
                _transaction.gasPrice,
                _transaction.chainId,
                _transaction.to,
                _transaction.data
            );
        } else {
            bytes[] memory raw = new bytes[](9);

            raw[0] = Lib_RLPWriter.encodeUint(_transaction.nonce);
            raw[1] = Lib_RLPWriter.encodeUint(_transaction.gasPrice);
            raw[2] = Lib_RLPWriter.encodeUint(_transaction.gasLimit);
            raw[3] = Lib_RLPWriter.encodeAddress(_transaction.to);
            raw[4] = Lib_RLPWriter.encodeUint(0);
            raw[5] = Lib_RLPWriter.encodeBytes(_transaction.data);
            raw[6] = Lib_RLPWriter.encodeUint(_transaction.chainId);
            raw[7] = Lib_RLPWriter.encodeBytes(bytes(''));
            raw[8] = Lib_RLPWriter.encodeBytes(bytes(''));

            return Lib_RLPWriter.encodeList(raw);
        }
    }

     /**
     * Decodes and then re-encodes an EOA transaction.
     * @param _transaction Compactly encoded EOA transaction.
     * @param _isEthSignedMessage Whether or not this is an eth signed message.
     * @return Transaction with original encoding.
     */
    function encodeEIP155Transaction(
        bytes memory _transaction,
        bool _isEthSignedMessage
    )
        internal
        pure
        returns (
            bytes memory
        )
    {
        return encodeEIP155Transaction(
            decodeEIP155Transaction(_transaction),
            _isEthSignedMessage
        );
    }

    /**
     * Encodes a standard OVM transaction.
     * @param _transaction OVM transaction to encode.
     * @return _encoded Encoded transaction bytes.
     */
    function encodeTransaction(
        Transaction memory _transaction
    )
        internal
        pure
        returns (
            bytes memory _encoded
        )
    {
        return abi.encodePacked(
            _transaction.timestamp,
            _transaction.blockNumber,
            _transaction.l1QueueOrigin,
            _transaction.l1TxOrigin,
            _transaction.entrypoint,
            _transaction.gasLimit,
            _transaction.data
        );
    }

    /**
     * Hashes a standard OVM transaction.
     * @param _transaction OVM transaction to encode.
     * @return _hash Hashed transaction
     */
    function hashTransaction(
        Transaction memory _transaction
    )
        internal
        pure
        returns (
            bytes32 _hash
        )
    {
        return keccak256(encodeTransaction(_transaction));
    }

    /**
     * Converts an OVM account to an EVM account.
     * @param _in OVM account to convert.
     * @return _out Converted EVM account.
     */
    function toEVMAccount(
        Account memory _in
    )
        internal
        pure
        returns (
            EVMAccount memory _out
        )
    {
        return EVMAccount({
            nonce: _in.nonce,
            balance: _in.balance,
            storageRoot: _in.storageRoot,
            codeHash: _in.codeHash
        });
    }

    /**
     * @notice RLP-encodes an account state struct.
     * @param _account Account state struct.
     * @return _encoded RLP-encoded account state.
     */
    function encodeEVMAccount(
        EVMAccount memory _account
    )
        internal
        pure
        returns (
            bytes memory _encoded
        )
    {
        bytes[] memory raw = new bytes[](4);

        // Unfortunately we can't create this array outright because
        // RLPWriter.encodeList will reject fixed-size arrays. Assigning
        // index-by-index circumvents this issue.
        raw[0] = Lib_RLPWriter.writeUint(_account.nonce);
        raw[1] = Lib_RLPWriter.writeUint(_account.balance);
        raw[2] = Lib_RLPWriter.writeBytes(abi.encodePacked(_account.storageRoot));
        raw[3] = Lib_RLPWriter.writeBytes(abi.encodePacked(_account.codeHash));

        return Lib_RLPWriter.writeList(raw);
    }

    /**
     * @notice Decodes an RLP-encoded account state into a useful struct.
     * @param _encoded RLP-encoded account state.
     * @return _account Account state struct.
     */
    function decodeEVMAccount(
        bytes memory _encoded
    )
        internal
        pure
        returns (
            EVMAccount memory _account
        )
    {
        Lib_RLPReader.RLPItem[] memory accountState = Lib_RLPReader.readList(_encoded);

        return EVMAccount({
            nonce: Lib_RLPReader.readUint256(accountState[0]),
            balance: Lib_RLPReader.readUint256(accountState[1]),
            storageRoot: Lib_RLPReader.readBytes32(accountState[2]),
            codeHash: Lib_RLPReader.readBytes32(accountState[3])
        });
    }

    /**
     * Calculates a hash for a given batch header.
     * @param _batchHeader Header to hash.
     * @return _hash Hash of the header.
     */
    function hashBatchHeader(
        Lib_OVMCodec.ChainBatchHeader memory _batchHeader
    )
        internal
        pure
        returns (
            bytes32 _hash
        )
    {
        return keccak256(
            abi.encode(
                _batchHeader.batchRoot,
                _batchHeader.batchSize,
                _batchHeader.prevTotalElements,
                _batchHeader.extraData
            )
        );
    }
}
