// SPDX-License-Identifier: UNLICENSED
// SPDX-License-Identifier: MIT
import { Lib_SafeExecutionManagerWrapper } from "../optimistic-ethereum/libraries/wrappers/Lib_SafeExecutionManagerWrapper.sol";

pragma solidity >0.5.0 <0.8.0;

import "hardhat/console.sol";

contract Helper_SimpleOvmDeployer {
    
    // A fallback function that allows us to choose between deploying two different initCodes
    function deploy(uint256 selection)
        external
    {
        // uint256 selection = abi.decode(msg.data, (uint256));
        console.log('selection', selection);
        bytes memory initCode;
        if(selection == 0) {
            // the resulting deployed bytecode is 0x00
            // do concat to be clear
            initCode = hex'600D380380600D6000396000f300';
        } else if(selection == 1){
            initCode = hex'600D380380600D6000396000f36020';
        }
        
        address addr = Lib_SafeExecutionManagerWrapper.safeCREATE(gasleft(), initCode);
        console.log("deployed address %s", addr);
    }
}
