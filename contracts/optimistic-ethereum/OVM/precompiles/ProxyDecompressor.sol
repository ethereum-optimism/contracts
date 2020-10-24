pragma solidity ^0.7.0;

/* Library Imports */
import { Lib_BytesUtils } from "../../libraries/utils/Lib_BytesUtils.sol";
import { Lib_OVMCodec } from "../../libraries/codec/Lib_OVMCodec.sol";
import { Lib_ECDSAUtils } from "../../libraries/utils/Lib_ECDSAUtils.sol";
import { Lib_SafeExecutionManagerWrapper } from "../../libraries/wrappers/Lib_SafeExecutionManagerWrapper.sol";

/* Contract Imports */
import { OVM_ExecutionManager } from "../execution/OVM_ExecutionManager.sol";

/**
 * @title ProxyDecompressor
 */
contract ProxyDecompressor {
    address internal owner;
    address internal implementation;
    // function _eoaUpgrade(address _newImplementation) external {
    //     require(owner == Lib_SafeExecutionManagerWrapper.safeCALLER(msg.sender));
    //     implementation = _newImplementation;
    // }

    // function safeCREATEEOA(
    //     bytes32 _messageHash,
    //     uint8 _v,
    //     bytes32 _r,
    //     bytes32 _s
    // ) external {
    //     Lib_SafeExecutionManagerWrapper.safeCREATEEOA(
    //         msg.sender,
    //         _messageHash,
    //         _v,
    //         _r,
    //         _s
    //     );
    // }

    // function init(address _implementation, address _owner) external {
    //     require(owner == address(0));
    //     owner = _owner;
    //     implementation = _implementation;
    // }
    // fallback() external {
    //     address impl = implementation;
    //     assembly {
    //         pop(delegatecall(gas(), impl, 0, 0, 0, calldatasize()))
    //     }
    // }

}
