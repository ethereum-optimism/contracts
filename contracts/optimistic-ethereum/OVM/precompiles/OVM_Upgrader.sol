// SPDX-License-Identifier: MIT
pragma solidity >0.5.0 <0.8.0;

/* Library Imports */
import { Lib_BytesUtils } from "../../libraries/utils/Lib_BytesUtils.sol";
import { Lib_OVMCodec } from "../../libraries/codec/Lib_OVMCodec.sol";
import { Lib_ECDSAUtils } from "../../libraries/utils/Lib_ECDSAUtils.sol";
import { Lib_SafeExecutionManagerWrapper } from "../../libraries/wrappers/Lib_SafeExecutionManagerWrapper.sol";

contract OVM_Upgrader {
    function doUpgrade(
        address _address,
        bytes memory _code
    ) external {
        Lib_SafeExecutionManagerWrapper.safeUPGRADE(_address, _code);
    }
}
