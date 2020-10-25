pragma solidity ^0.7.0;

/* Library Imports */
import { Lib_BytesUtils } from "../../libraries/utils/Lib_BytesUtils.sol";
import { Lib_OVMCodec } from "../../libraries/codec/Lib_OVMCodec.sol";
import { Lib_ECDSAUtils } from "../../libraries/utils/Lib_ECDSAUtils.sol";
import { Lib_SafeExecutionManagerWrapper } from "../../libraries/wrappers/Lib_SafeExecutionManagerWrapper.sol";

/* Contract Imports */
import { OVM_ExecutionManager } from "../execution/OVM_ExecutionManager.sol";
import { console } from "@nomiclabs/buidler/console.sol";

/**
 * @title ProxyEOA
 */
contract ProxyEOA {
    address public implementation  = 0x1212121212121212121212121212121212121212;// TODO REPLACE WITH EOA_PRECOMPILE_ADDRESS

    function upgradeEOA(address _implementation) external {
        require(
            Lib_SafeExecutionManagerWrapper.safeADDRESS(msg.sender) ==
            Lib_SafeExecutionManagerWrapper.safeCALLER(msg.sender),
            "EOAs can only upgrade their own EOA implementation"
        );
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
