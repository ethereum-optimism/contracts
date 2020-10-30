pragma solidity ^0.7.0;

/* Library Imports */
import { Lib_BytesUtils } from "../../libraries/utils/Lib_BytesUtils.sol";
import { Lib_OVMCodec } from "../../libraries/codec/Lib_OVMCodec.sol";
import { Lib_ECDSAUtils } from "../../libraries/utils/Lib_ECDSAUtils.sol";
import { Lib_SafeExecutionManagerWrapper } from "../../libraries/wrappers/Lib_SafeExecutionManagerWrapper.sol";

/**
 * @title OVM_ProxyECDSAContractAccount
 */
contract OVM_ProxyECDSAContractAccount {

    /***************
     * Constructor *
     ***************/

    constructor(
        address _implementation
    ) {
        _setImplementation(_implementation);
    }


    /*********************
     * Fallback Function *
     *********************/

    fallback()
        external
    {
        Lib_SafeExecutionManagerWrapper.safeDELEGATECALL(
            msg.sender,
            gasleft(),
            _getImplementation(),
            msg.data
        );
    }


    /********************
     * Public Functions *
     ********************/

    function upgrade(
        address _implementation
    )
        external
    {
        Lib_SafeExecutionManagerWrapper.safeREQUIRE(
            msg.sender,
            Lib_SafeExecutionManagerWrapper.safeADDRESS(msg.sender) == Lib_SafeExecutionManagerWrapper.safeCALLER(msg.sender),
            "EOAs can only upgrade their own EOA implementation"
        );

        _setImplementation(_implementation);
    }


    /**********************
     * Internal Functions *
     **********************/

    function _setImplementation(
        address _implementation
    )
        internal
    {
        Lib_SafeExecutionManagerWrapper.safeSSTORE(
            msg.sender,
            bytes32(uint256(0)),
            bytes32(bytes20(_implementation))
        );
    }

    function _getImplementation()
        internal
        returns (
            address _implementation
        )
    {
        return address(bytes20(
            Lib_SafeExecutionManagerWrapper.safeSSLOAD(
                msg.sender,
                bytes32(uint256(0))
            )
        ));
    }
}
