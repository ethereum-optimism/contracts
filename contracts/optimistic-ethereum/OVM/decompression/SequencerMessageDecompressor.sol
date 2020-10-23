pragma solidity ^0.7.0;

/* Library Imports */
import { Lib_BytesUtils } from "../../libraries/utils/Lib_BytesUtils.sol";
import { Lib_OVMCodec } from "../../libraries/codec/Lib_OVMCodec.sol";
import { Lib_ECDSAUtils } from "../../libraries/utils/Lib_ECDSAUtils.sol";
import { Lib_SafeExecutionManagerWrapper } from "../../libraries/wrappers/Lib_SafeExecutionManagerWrapper.sol";

/* Contract Imports */
import { OVM_ExecutionManager } from "../execution/OVM_ExecutionManager.sol";

/**
 * @title SequencerMessageDecompressor
 */
contract SequencerMessageDecompressor {
    /*
     * Data Structures
     */
    
    enum TransactionType {
        EOA_CONTRACT_CREATION,
        NATIVE_ETH_TRANSACTION,
        ETH_SIGNED_MESSAGE
    }


    /*
     * Fallback Function
     */

    /**
     * We use the fallback here to parse the compressed encoding used by the
     * Sequencer.
     *
     * Calldata format:
     * - [ 1 byte   ] Transaction type (00 for EOA create, 01 for native tx, 02 for eth signed tx)
     * - [ 1 byte   ] Signature `v` parameter
     * - [ 32 bytes ] Signature `r` parameter
     * - [ 32 bytes ] Signature `s` parameter
     * - [ ?? bytes ] :
     *      IF transaction type == 00
     *      - [ 32 bytes ] Hash of the signed message
     *      ELSE
     *      - [ 2 bytes  ] Transaction nonce
     *      - [ 3 bytes  ] Transaction gas limit
     *      - [ 1 byte   ] Transaction gas price
     *      - [ 4 bytes  ] Transaction chain ID
     *      - [ 20 bytes ] Transaction target address
     *      - [ ?? bytes ] Transaction data
     */
    fallback()
        external
    {
        TransactionType transactionType = _getTransactionType(Lib_BytesUtils.toUint256(Lib_BytesUtils.slice(msg.data, 0, 1)));
        uint8 v = uint8(Lib_BytesUtils.toUint256(Lib_BytesUtils.slice(msg.data, 1, 1)));
        bytes32 r = Lib_BytesUtils.toBytes32(Lib_BytesUtils.slice(msg.data, 2, 32));
        bytes32 s = Lib_BytesUtils.toBytes32(Lib_BytesUtils.slice(msg.data, 34, 32));
        
        if (transactionType == TransactionType.EOA_CONTRACT_CREATION) {
            // Pull out the message hash so we can verify the signature.
            bytes32 messageHash = Lib_BytesUtils.toBytes32(Lib_BytesUtils.slice(msg.data, 66, 32));
            // OVM_ExecutionManager(msg.sender).ovmCREATEEOA(messageHash, uint8(v), r, s);
        } else {
            // Remainder is the message to execute.
            bytes memory message = Lib_BytesUtils.slice(msg.data, 66);
            bool isEthSignedMessage = transactionType == TransactionType.ETH_SIGNED_MESSAGE;

            // Need to re-encode the message based on the original encoding.
            bytes memory encodedTx = Lib_OVMCodec.encodeEIP155Transaction(
                message,
                isEthSignedMessage
            );

            address target = Lib_ECDSAUtils.recover(
                encodedTx,
                isEthSignedMessage,
                uint8(v),
                r,
                s,
                420// Lib_SafeExecutionManagerWrapper.safeCHAINID(msg.sender)
            );

            bytes memory callbytes = abi.encodeWithSelector(
                bytes4(keccak256("execute(bytes,bool,uint8,bytes32,bytes32)")),
                message,
                isEthSignedMessage,
                uint8(v),
                r,
                s
            );

            // Lib_SafeExecutionManagerWrapper.safeCALL(
            //     msg.sender,
            //     gasleft(),
            //     target,
            //     callbytes
            // );
        }
    }

    
    /*
     * Internal Functions
     */
    
    /**
     * Converts a uint256 into a TransactionType enum.
     * @param _transactionType Transaction type index.
     * @return Transaction type enum value.
     */
    function _getTransactionType(
        uint256 _transactionType
    )
        internal
        pure
        returns (
            TransactionType
        )
    {
        require(
            _transactionType <= 2,
            "Transaction type must be 0, 1, or 2"
        );

        if (_transactionType == 0) {
            return TransactionType.EOA_CONTRACT_CREATION;
        } else if (_transactionType == 1) {
            return TransactionType.NATIVE_ETH_TRANSACTION;
        } else {
            return TransactionType.ETH_SIGNED_MESSAGE;
        }
    }
}
