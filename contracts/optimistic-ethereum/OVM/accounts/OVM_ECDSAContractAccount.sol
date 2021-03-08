// SPDX-License-Identifier: MIT
pragma solidity >0.5.0 <0.8.0;
pragma experimental ABIEncoderV2;

/* Interface Imports */
import { iOVM_ECDSAContractAccount } from "../../iOVM/accounts/iOVM_ECDSAContractAccount.sol";

/* Library Imports */
import { Lib_EIP155Tx } from "../../libraries/codec/Lib_EIP155Tx.sol";
import { Lib_SafeExecutionManagerWrapper } from "../../libraries/wrappers/Lib_SafeExecutionManagerWrapper.sol";
import { Lib_SafeMathWrapper } from "../../libraries/wrappers/Lib_SafeMathWrapper.sol";

/**
 * @title OVM_ECDSAContractAccount
 * @dev The ECDSA Contract Account can be used as the implementation for a ProxyEOA deployed by the
 * ovmCREATEEOA operation. It enables backwards compatibility with Ethereum's Layer 1, by 
 * providing eth_sign and EIP155 formatted transaction encodings.
 *
 * Compiler used: solc
 * Runtime target: OVM
 */
contract OVM_ECDSAContractAccount is iOVM_ECDSAContractAccount {
    using Lib_EIP155Tx for Lib_EIP155Tx.EIP155Tx;


    /*************
     * Constants *
     *************/

    // TODO: should be the amount sufficient to cover the gas costs of all of the transactions up
    // to and including the CALL/CREATE which forms the entrypoint of the transaction.
    uint256 constant EXECUTION_VALIDATION_GAS_OVERHEAD = 25000;
    address constant ETH_ERC20_ADDRESS = 0x4200000000000000000000000000000000000006;


    /********************
     * Public Functions *
     ********************/

    /**
     * Executes a signed transaction.
     * @param _encodedTransaction Signed EIP155 transaction.
     * @return Whether or not the call returned (rather than reverted).
     * @return Data returned by the call.
     */
    function execute(
        bytes memory _encodedTransaction
    )
        override
        public
        returns (
            bool,
            bytes memory
        )
    {
        Lib_EIP155Tx.EIP155Tx memory transaction = Lib_EIP155Tx.decode(
            _encodedTransaction,
            Lib_SafeExecutionManagerWrapper.safeCHAINID()
        );

        // Recovery parameter being something other than 0 or 1 indicates that this transaction was
        // signed using the wrong chain ID. We really should have this logic inside of Lib_EIP155Tx
        // but I'd prefer not to add the "safeREQUIRE" logic into that library. So it'll live here
        // for now.
        Lib_SafeExecutionManagerWrapper.safeREQUIRE(
            transaction.recoveryParam < 2,
            "OVM_ECDSAContractAccount: Transaction was signed with the wrong chain ID."
        );

        // Address of this contract within the ovm (ovmADDRESS) should be the same as the
        // recovered address of the user who signed this message. This is how we manage to shim
        // account abstraction even though the user isn't a contract.
        // Need to make sure that the transaction nonce is right and bump it if so.
        Lib_SafeExecutionManagerWrapper.safeREQUIRE(
            transaction.sender() == Lib_SafeExecutionManagerWrapper.safeADDRESS(),
            "Signature provided for EOA transaction execution is invalid."
        );

        // Need to make sure that the transaction nonce is right.
        Lib_SafeExecutionManagerWrapper.safeREQUIRE(
            transaction.nonce == Lib_SafeExecutionManagerWrapper.safeGETNONCE(),
            "Transaction nonce does not match the expected nonce."
        );

        // TEMPORARY: Disable gas checks for mainnet.
        // // Need to make sure that the gas is sufficient to execute the transaction.
        // Lib_SafeExecutionManagerWrapper.safeREQUIRE(
        //    gasleft() >= Lib_SafeMathWrapper.add(decodedTx.gasLimit, EXECUTION_VALIDATION_GAS_OVERHEAD),
        //    "Gas is not sufficient to execute the transaction."
        // );

        // Transfer fee to relayer. We assume that whoever called this function is the relayer,
        // hence the usage of CALLER. Fee is computed as gasLimit * gasPrice.
        address relayer = Lib_SafeExecutionManagerWrapper.safeCALLER();
        uint256 fee = Lib_SafeMathWrapper.mul(transaction.gasLimit, transaction.gasPrice);
        (bool success, ) = Lib_SafeExecutionManagerWrapper.safeCALL(
            gasleft(),
            ETH_ERC20_ADDRESS,
            abi.encodeWithSignature(
                "transfer(address,uint256)",
                relayer,
                fee
            )
        );

        // Make sure the transfer was actually successful.
        Lib_SafeExecutionManagerWrapper.safeREQUIRE(
            success == true,
            "Fee was not transferred to relayer."
        );

        if (transaction.isCreate) {
            address created = Lib_SafeExecutionManagerWrapper.safeCREATE(
                transaction.gasLimit,
                transaction.data
            );

            // EVM doesn't tell us whether a contract creation failed, even if it reverted during
            // initialization. Always return `true` for our success value here.
            return (true, abi.encode(created));
        } else {
            // We only want to bump the nonce for `ovmCALL` because `ovmCREATE` automatically bumps
            // the nonce of the calling account. Normally an EOA would bump the nonce for both
            // cases, but since this is a contract we'd end up bumping the nonce twice.
            Lib_SafeExecutionManagerWrapper.safeSETNONCE(transaction.nonce + 1);

            return Lib_SafeExecutionManagerWrapper.safeCALL(
                transaction.gasLimit,
                transaction.to,
                transaction.data
            );
        }
    }
}
