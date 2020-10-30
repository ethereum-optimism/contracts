pragma solidity ^0.7.0;

/* Library Imports */
import { Lib_BytesUtils } from "../../libraries/utils/Lib_BytesUtils.sol";
import { Lib_OVMCodec } from "../../libraries/codec/Lib_OVMCodec.sol";
import { Lib_ECDSAUtils } from "../../libraries/utils/Lib_ECDSAUtils.sol";
import { Lib_SafeExecutionManagerWrapper } from "../../libraries/wrappers/Lib_SafeExecutionManagerWrapper.sol";
/* Library Imports */
import { Lib_SafeExecutionManagerWrapper } from "../../libraries/wrappers/Lib_SafeExecutionManagerWrapper.sol";

/**
 * @title OVM_ProxyEOA
 */
contract OVM_ProxyEOA {
    address public implementation  = 0x4200000000000000000000000000000000000003;
    
    function upgradeEOA(address _implementation) external {
        if (
            Lib_SafeExecutionManagerWrapper.safeADDRESS(msg.sender) !=
            Lib_SafeExecutionManagerWrapper.safeCALLER(msg.sender)
        ) {
            Lib_SafeExecutionManagerWrapper.safeREVERT(
                msg.sender,
                bytes("EOAs can only upgrade their own EOA implementation")
            );
        }
        implementation = _implementation;
    }
    fallback() external {
        address impl = implementation;
        assembly {
            calldatacopy(0x0, 0x0, calldatasize())
            pop(delegatecall(gas(), impl, 0, calldatasize(), 0, 0))
        }
    }

}
