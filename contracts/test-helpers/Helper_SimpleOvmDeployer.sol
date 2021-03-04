// SPDX-License-Identifier: UNLICENSED
// SPDX-License-Identifier: MIT
import { Lib_SafeExecutionManagerWrapper } from "../optimistic-ethereum/libraries/wrappers/Lib_SafeExecutionManagerWrapper.sol";


pragma solidity >0.5.0 <0.8.0;

contract Helper_SimpleOvmDeployer {
    
    fallback()
        external
    {
        Lib_SafeExecutionManagerWrapper.safeCREATE(gasleft(), "00");
    }
}
