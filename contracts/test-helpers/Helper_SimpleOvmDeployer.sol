// SPDX-License-Identifier: UNLICENSED
// SPDX-License-Identifier: MIT
import { Lib_SafeExecutionManagerWrapper } from "../optimistic-ethereum/libraries/wrappers/Lib_SafeExecutionManagerWrapper.sol";

pragma solidity >0.5.0 <0.8.0;

contract Helper_SimpleOvmDeployer {
    
    fallback()
        external
    {
        // the resulting deployed bytecode is 0x00
        bytes memory initCode = hex'600D380380600D6000396000f300';
        address addr = Lib_SafeExecutionManagerWrapper.safeCREATE(gasleft(), initCode);
    }
}
