pragma solidity ^0.7.0;

/* Library Imports */
import { Lib_SafeExecutionManagerWrapper } from "../../libraries/wrappers/Lib_SafeExecutionManagerWrapper.sol";

/**
 * @title OVM_ProxyEntrypoint
 */
contract OVM_ProxyEntrypoint {
    address public owner;
    address public implementation;
    function upgradeEntrypoint(address _newImplementation) external {
        if (owner != Lib_SafeExecutionManagerWrapper.safeCALLER(msg.sender)) {
            Lib_SafeExecutionManagerWrapper.safeREVERT(
                msg.sender,
                bytes("only owner can upgrade the Entrypoint")
            );
        }
        implementation = _newImplementation;
    }

    function init(address _implementation, address _owner) external {
        if (owner != address(0)) {
            Lib_SafeExecutionManagerWrapper.safeREVERT(
                msg.sender,
                bytes("ProxyEntrypoint has already been inited")
            );
        }
        owner = _owner;
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
