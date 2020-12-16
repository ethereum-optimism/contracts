pragma solidity ^0.7.0;

import { Lib_RingBuffer } from "../../libraries/utils/Lib_RingBuffer.sol";

// TODO: Figure out auth.
contract OVM_ChainStorageContainer {
    using Lib_RingBuffer for Lib_RingBuffer.RingBuffer;

    Lib_RingBuffer.RingBuffer buffer;

    function setGlobalMetadata(
        bytes27 _globalMetadata
    )
        public
    {
        return buffer.setExtraData(_globalMetadata);
    }

    function getGlobalMetadata()
        public
        view
        returns (
            bytes27
        )
    {
        return buffer.getExtraData();
    }
    
    function length()
        public
        view
        returns (
            uint256
        )
    {
        return uint256(buffer.getLength());
    }

    function push(
        bytes32 _object,
        bytes27 _globalMetadata
    )
        public
    {
        buffer.push(_object, _globalMetadata);
    }

    function push2(
        bytes32 _objectA,
        bytes32 _objectB
    )
        public
    {
        buffer.push2(_objectA, _objectB);
    }

    function get(
        uint256 _index
    )
        public
        view
        returns (
            bytes32
        )
    {
        return buffer.get(uint40(_index));
    }
    
    function del(
        uint256 _index,
        bytes27 _globalMetadata
    )
        public
    {
        buffer.deleteElementsAfterInclusive(
            uint40(_index),
            _globalMetadata
        );
    }

    function overwrite(
        uint256 _index
    )
        public
    {
        buffer.nextOverwritableIndex = _index;
    }
}
