pragma solidity ^0.7.0;

/* Library Imports */
import { Lib_BytesUtils } from "../../libraries/utils/Lib_BytesUtils.sol";
import { Lib_OVMCodec } from "../../libraries/codec/Lib_OVMCodec.sol";
import { Lib_ECDSAUtils } from "../../libraries/utils/Lib_ECDSAUtils.sol";
import { Lib_SafeExecutionManagerWrapper } from "../../libraries/wrappers/Lib_SafeExecutionManagerWrapper.sol";

/* Contract Imports */
import { OVM_ExecutionManager } from "../execution/OVM_ExecutionManager.sol";
import { console } from "@nomiclabs/buidler/console.sol";

/**
 * @title SequencerMessageDecompressor
 */
contract SequencerMessageDecompressor {
    /*
     * Data Structures
     */
    
    enum TransactionType {
        NATIVE_ETH_TRANSACTION,
        EOA_CONTRACT_CREATION,
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
     * - [ 32 bytes ] Signature `r` parameter
     * - [ 32 bytes ] Signature `s` parameter
     * - [ 1 byte   ] Signature `v` parameter
     * - [ ?? bytes ] :
     *      IF transaction type == 01
     *      - [ 32 bytes ] Hash of the signed message
     *      ELSE
     *      - [ 3 bytes  ] Gas Limit
     *      - [ 3 bytes  ] Gas Price
     *      - [ 3 byte   ] Transaction Nonce
     *      - [ 20 bytes  ] Transaction target address
     *      - [ ?? bytes ] Transaction data
     */
    fallback()
        external
    {
        TransactionType transactionType = _getTransactionType(Lib_BytesUtils.toUint8(msg.data, 0));
        bytes32 r = Lib_BytesUtils.toBytes32(Lib_BytesUtils.slice(msg.data, 1, 32));
        bytes32 s = Lib_BytesUtils.toBytes32(Lib_BytesUtils.slice(msg.data, 33, 32));
        uint8 v = Lib_BytesUtils.toUint8(msg.data, 65);
        // console.log("v:", uint256(v));
        // console.logBytes32(r);
        // console.logBytes32(s);
        
        if (transactionType == TransactionType.EOA_CONTRACT_CREATION) {
            // Pull out the message hash so we can verify the signature.
            bytes32 messageHash = Lib_BytesUtils.toBytes32(Lib_BytesUtils.slice(msg.data, 66, 32));
            Lib_SafeExecutionManagerWrapper.safeCREATEEOA(msg.sender, messageHash, uint8(v), r, s);
        } else {
            // Remainder is the message to execute.
            bytes memory message = Lib_BytesUtils.slice(msg.data, 66);
            bool isEthSignedMessage = transactionType == TransactionType.ETH_SIGNED_MESSAGE;
            console.log("Is ETHSignedMessage:", isEthSignedMessage);
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
                Lib_SafeExecutionManagerWrapper.safeCHAINID(msg.sender)
            );
            console.log("target:");
            console.logAddress(target);
            bytes memory callbytes = abi.encodeWithSignature(
                "execute(bytes,uint8,uint8,bytes32,bytes32)",
                message,
                isEthSignedMessage,
                uint8(v),
                r,
                s
            );
            Lib_SafeExecutionManagerWrapper.safeCALL(
                msg.sender,
                gasleft(),
                target,
                callbytes
            );
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
        uint8 _transactionType
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
            return TransactionType.NATIVE_ETH_TRANSACTION;
        } else if (_transactionType == 1) {
            return TransactionType.EOA_CONTRACT_CREATION;
        } else {
            return TransactionType.ETH_SIGNED_MESSAGE;
        }
    }
}
