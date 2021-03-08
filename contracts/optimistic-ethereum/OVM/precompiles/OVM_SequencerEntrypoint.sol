// SPDX-License-Identifier: MIT
pragma solidity >0.5.0 <0.8.0;

/* Library Imports */
import { Lib_EIP155Tx } from "../../libraries/codec/Lib_EIP155Tx.sol";
import { Lib_SafeExecutionManagerWrapper } from "../../libraries/wrappers/Lib_SafeExecutionManagerWrapper.sol";

/**
 * @title OVM_SequencerEntrypoint
 * @dev The Sequencer Entrypoint is a predeploy which, despite its name, can in fact be called by 
 * any account. It accepts a more efficient compressed calldata format, which it decompresses and 
 * encodes to the standard EIP155 transaction format.
 * This contract is the implementation referenced by the Proxy Sequencer Entrypoint, thus enabling
 * the Optimism team to upgrade the decompression of calldata from the Sequencer.
 * 
 * Compiler used: solc
 * Runtime target: OVM
 */
contract OVM_SequencerEntrypoint {
    using Lib_EIP155Tx for Lib_EIP155Tx.EIP155Tx;


    /*********************
     * Fallback Function *
     *********************/

    fallback()
        external
    {
        Lib_EIP155Tx.EIP155Tx memory transaction = Lib_EIP155Tx.decode(msg.data);
        address sender = transaction.sender();

        if (Lib_SafeExecutionManagerWrapper.safeEXTCODESIZE(sender) == 0) {
            Lib_SafeExecutionManagerWrapper.safeCREATEEOA(
                transaction.hash(),
                transaction.v, // Chain ID?
                transaction.r,
                transaction.s
            );
        }

        Lib_SafeExecutionManagerWrapper.safeCALL(
            gasleft(),
            sender,
            abi.encodeWithSignature(
                "execute(bytes)",
                msg.data
            )
        );
    }
}
