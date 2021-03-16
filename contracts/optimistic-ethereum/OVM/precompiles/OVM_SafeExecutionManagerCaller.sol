// SPDX-License-Identifier: MIT
pragma solidity >0.5.0 <0.8.0;

/**
 * @title OVM_SafeExecutionManagerCaller
 * 
 * Compiler used: solc
 * Runtime target: OVM
 * Predeploy address: 0x4200000000000000000000000000000000000009
 */
contract OVM_SafeExecutionManagerCaller {
    fallback()
        external
    {
        (bool success, bytes memory returndata) = msg.sender.call(msg.data);

        if (success) {
            assembly {
                return(add(returndata, 0x20), mload(returndata))
            }
        } else {
            assembly {
                revert(add(returndata, 0x20), mload(returndata))
            }
        }
    }
}
