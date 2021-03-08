// SPDX-License-Identifier: MIT
pragma solidity >0.5.0 <0.9.0;
pragma experimental ABIEncoderV2;

/* Library Imports */
import { Lib_RLPReader } from "../rlp/Lib_RLPReader.sol";
import { Lib_RLPWriter } from "../rlp/Lib_RLPWriter.sol";

import { console } from "hardhat/console.sol";

library Lib_EIP155Tx {
    struct EIP155Tx {
        uint256 nonce;
        uint256 gasPrice;
        uint256 gasLimit;
        address to;
        uint256 value;
        bytes data;
        uint8 recoveryParam;
        uint8 v;
        bytes32 r;
        bytes32 s;
        bool isCreate;
        uint256 chainId;
    }

    function decode(
        bytes memory _encoded,
        uint256 _chainId
    )
        internal
        pure
        returns (
            EIP155Tx memory
        )
    {
        Lib_RLPReader.RLPItem[] memory decoded = Lib_RLPReader.readList(_encoded);

        uint8 v = uint8(Lib_RLPReader.readUint256(decoded[6]));
        return EIP155Tx({
            nonce: Lib_RLPReader.readUint256(decoded[0]),
            gasPrice: Lib_RLPReader.readUint256(decoded[1]),
            gasLimit: Lib_RLPReader.readUint256(decoded[2]),
            to: Lib_RLPReader.readAddress(decoded[3]),
            value: Lib_RLPReader.readUint256(decoded[4]),
            data: Lib_RLPReader.readBytes(decoded[5]),
            recoveryParam: uint8(v - 35 - 2 * _chainId),
            v: v,
            r: Lib_RLPReader.readBytes32(decoded[7]),
            s: Lib_RLPReader.readBytes32(decoded[8]),
            isCreate: Lib_RLPReader.readBytes(decoded[3]).length == 0,
            chainId: _chainId
        });
    }

    function encode(
        EIP155Tx memory _transaction,
        bool _includeSignature
    )
        internal
        pure
        returns (
            bytes memory
        )
    {
        bytes[] memory raw = new bytes[](9);

        raw[0] = Lib_RLPWriter.writeUint(_transaction.nonce);
        raw[1] = Lib_RLPWriter.writeUint(_transaction.gasPrice);
        raw[2] = Lib_RLPWriter.writeUint(_transaction.gasLimit);
        if (_transaction.isCreate) {
            raw[3] = Lib_RLPWriter.writeBytes('');
        } else {
            raw[3] = Lib_RLPWriter.writeAddress(_transaction.to);
        }
        raw[4] = Lib_RLPWriter.writeUint(0);
        raw[5] = Lib_RLPWriter.writeBytes(_transaction.data);
        if (_includeSignature) {
            raw[6] = Lib_RLPWriter.writeUint(_transaction.v);
            raw[7] = Lib_RLPWriter.writeBytes32(_transaction.r);
            raw[8] = Lib_RLPWriter.writeBytes32(_transaction.s);
        } else {
            raw[6] = Lib_RLPWriter.writeUint(_transaction.chainId); // Chain ID?
            raw[7] = Lib_RLPWriter.writeBytes('');
            raw[8] = Lib_RLPWriter.writeBytes('');
        }

        return Lib_RLPWriter.writeList(raw);
    }

    function hash(
        EIP155Tx memory _transaction
    )
        internal
        pure
        returns (
            bytes32
        )
    {
        return keccak256(encode(_transaction, false));
    }

    function sender(
        EIP155Tx memory _transaction
    )
        internal
        view
        returns (
            address
        )
    {
        return ecrecover(
            hash(_transaction),
            _transaction.recoveryParam + 27,
            _transaction.r,
            _transaction.s
        );
    }
}
