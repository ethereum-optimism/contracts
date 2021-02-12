// SPDX-License-Identifier: MIT
pragma solidity >0.5.0 <0.8.0;

/* Library Imports */
import { Lib_AddressResolver } from "../../libraries/resolver/Lib_AddressResolver.sol";

/* Interface Imports */
import { iOVM_L2CrossDomainMessenger } from "../../iOVM/bridge/iOVM_L2CrossDomainMessenger.sol";

/* Contract Imports */
import { OVM_L2ERC20Gateway } from "../bridge/ERC20/OVM_L2ERC20Gateway.sol";

/**
 * @title OVM_ETH
 * @dev The ETH predeploy provides an ERC20 interface for ETH deposited to Layer 2. Note that 
 * unlike on Layer 1, Layer 2 accounts do not have a balance field.
 * 
 * Compiler used: optimistic-solc
 * Runtime target: OVM
 */
contract OVM_ETH is Lib_AddressResolver, OVM_L2ERC20Gateway {
    constructor(
        address _libAddressManager
    ) 
        Lib_AddressResolver(_libAddressManager)
        OVM_L2ERC20Gateway(
            iOVM_L2CrossDomainMessenger(resolve("OVM_L2CrossDomainMessenger")),
            18, // WETH decimals
            "ovmWETH",
            "oWETH"
        )
        public 
    {
        // require(address(messenger) != address(0), "ovmWETH must only be deployed after the OVM_L2CrossDomainMessenger");
    }
}
