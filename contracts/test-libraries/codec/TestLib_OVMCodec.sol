// SPDX-License-Identifier: MIT
pragma solidity >0.5.0 <0.8.0;
pragma experimental ABIEncoderV2;

/* Library Imports */
import { Lib_OVMCodec } from "../../optimistic-ethereum/libraries/codec/Lib_OVMCodec.sol";

/**
 * @title TestLib_OVMCodec
 */
contract TestLib_OVMCodec {

    function encodeTransaction(
        Lib_OVMCodec.Transaction memory _transaction
    )
        public
        pure
        returns (
            bytes memory _encoded
        )
    {
        return Lib_OVMCodec.encodeTransaction(_transaction);
    }

    function hashTransaction(
        Lib_OVMCodec.Transaction memory _transaction
    )
        public
        pure
        returns (
            bytes32 _hash
        )
    {
        return Lib_OVMCodec.hashTransaction(_transaction);
    }
}
