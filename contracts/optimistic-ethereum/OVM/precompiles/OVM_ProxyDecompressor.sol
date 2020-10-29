pragma solidity ^0.7.0;

/* Library Imports */
import { Lib_SafeExecutionManagerWrapper } from "../../libraries/wrappers/Lib_SafeExecutionManagerWrapper.sol";

/**
 * @title OVM_ProxyDecompressor
 */
contract OVM_ProxyDecompressor {
    address public owner;
    address public implementation;
    function upgradeDecompressor(address _newImplementation) external {
        require(owner == Lib_SafeExecutionManagerWrapper.safeCALLER(msg.sender), "only owner can upgrade the decompressor");
        implementation = _newImplementation;
    }

    function init(address _implementation, address _owner) external {
        require(owner == address(0));
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
