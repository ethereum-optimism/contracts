pragma solidity ^0.7.0;

/* Library Imports */
import { Lib_RingBuffer } from "../../libraries/utils/Lib_RingBuffer.sol";

/* Interface Imports */
import { iOVM_ChainStorageContainer } from "../../iOVM/chain/iOVM_ChainStorageContainer.sol";

/**
 * @title OVM_ChainStorageContainer
 */
contract OVM_ChainStorageContainer is iOVM_ChainStorageContainer {

    /*************
     * Libraries *
     *************/

    using Lib_RingBuffer for Lib_RingBuffer.RingBuffer;


    /*************
     * Variables *
     *************/

    Lib_RingBuffer.RingBuffer buffer;


    /********************
     * Public Functions *
     ********************/

    /**
     * @inheritdoc iOVM_ChainStorageContainer
     */
    function setGlobalMetadata(
        bytes27 _globalMetadata
    )
        override
        public
    {
        return buffer.setExtraData(_globalMetadata);
    }

    /**
     * @inheritdoc iOVM_ChainStorageContainer
     */
    function getGlobalMetadata()
        override
        public
        view
        returns (
            bytes27
        )
    {
        return buffer.getExtraData();
    }

    /**
     * @inheritdoc iOVM_ChainStorageContainer
     */
    function length()
        override
        public
        view
        returns (
            uint256
        )
    {
        return uint256(buffer.getLength());
    }

    /**
     * @inheritdoc iOVM_ChainStorageContainer
     */
    function push(
        bytes32 _object
    )
        override
        public
    {
        buffer.push(_object);
    }

    /**
     * @inheritdoc iOVM_ChainStorageContainer
     */
    function push(
        bytes32 _object,
        bytes27 _globalMetadata
    )
        override
        public
    {
        buffer.push(_object, _globalMetadata);
    }

    /**
     * @inheritdoc iOVM_ChainStorageContainer
     */
    function push2(
        bytes32 _objectA,
        bytes32 _objectB
    )
        override
        public
    {
        buffer.push2(_objectA, _objectB);
    }

    /**
     * @inheritdoc iOVM_ChainStorageContainer
     */
    function push2(
        bytes32 _objectA,
        bytes32 _objectB,
        bytes27 _globalMetadata
    )
        override
        public
    {
        buffer.push2(_objectA, _objectB, _globalMetadata);
    }

    /**
     * @inheritdoc iOVM_ChainStorageContainer
     */
    function get(
        uint256 _index
    )
        override
        public
        view
        returns (
            bytes32
        )
    {
        return buffer.get(uint40(_index));
    }
    
    /**
     * @inheritdoc iOVM_ChainStorageContainer
     */
    function del(
        uint256 _index
    )
        override
        public
    {
        buffer.deleteElementsAfterInclusive(
            uint40(_index)
        );
    }
    
    /**
     * @inheritdoc iOVM_ChainStorageContainer
     */
    function del(
        uint256 _index,
        bytes27 _globalMetadata
    )
        override
        public
    {
        buffer.deleteElementsAfterInclusive(
            uint40(_index),
            _globalMetadata
        );
    }

    /**
     * @inheritdoc iOVM_ChainStorageContainer
     */
    function overwritable(
        uint256 _index
    )
        override
        public
    {
        buffer.nextOverwritableIndex = _index;
    }
}
