// SPDX-License-Identifier: UNLICENSED
// SPDX-License-Identifier: MIT
import { Lib_SafeExecutionManagerWrapper } from "../optimistic-ethereum/libraries/wrappers/Lib_SafeExecutionManagerWrapper.sol";
import "hardhat/console.sol";


pragma solidity >0.5.0 <0.8.0;

contract Helper_SimpleOvmDeployer {
    
    constructor(){
        console.log('Helper_SimpleOvmDeployer');
    }

    fallback()
        external
    {
        Lib_SafeExecutionManagerWrapper.safeCREATE(gasleft(), "00");
        console.log('deployed with bytecode: 0x00');
    }
}
