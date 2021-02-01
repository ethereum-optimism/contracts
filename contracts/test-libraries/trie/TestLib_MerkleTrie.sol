// SPDX-License-Identifier: MIT
pragma solidity >0.5.0 <0.8.0;

/* Library Imports */
import { Lib_MerkleTrie } from "../../optimistic-ethereum/libraries/trie/Lib_MerkleTrie.sol";

/**
 * @title TestLib_MerkleTrie
 */
contract TestLib_MerkleTrie {

    function verifyInclusionProof(
        bytes memory _key,
        bytes memory _value,
        bytes memory _proof,
        bytes32 _root
    )
        public
        pure
        returns (
            bool
        )
    {
        return Lib_MerkleTrie.verifyInclusionProof(
            _key,
            _value,
            _proof,
            _root
        );
    }

    function verifyExclusionProof(
        bytes memory _key,
        bytes memory _proof,
        bytes32 _root
    )
        public
        pure
        returns (
            bool
        )
    {
        return Lib_MerkleTrie.verifyExclusionProof(
            _key,
            _proof,
            _root
        );
    }

    function update(
        bytes memory _key,
        bytes memory _value,
        bytes memory _proof,
        bytes32 _root
    )
        public
        pure
        returns (
            bytes32
        )
    {
        return Lib_MerkleTrie.update(
            _key,
            _value,
            _proof,
            _root
        );
    }

    function get(
        bytes memory _key,
        bytes memory _proof,
        bytes32 _root
    )
        public
        pure
        returns (
            bool,
            bytes memory
        )
    {
        return Lib_MerkleTrie.get(
            _key,
            _proof,
            _root
        );
    }

    function getSingleNodeRootHash(
        bytes memory _key,
        bytes memory _value
    )
        public
        pure
        returns (
            bytes32
        )
    {
        return Lib_MerkleTrie.getSingleNodeRootHash(
            _key,
            _value
        );
    }
}
