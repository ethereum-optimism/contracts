// SPDX-License-Identifier: MIT
pragma solidity >0.5.0 <0.8.0;

/* Library Imports */
import { Lib_AddressResolver } from "../../libraries/resolver/Lib_AddressResolver.sol";

/* Interface Imports */
import { iOVM_L2CrossDomainMessenger } from "../../iOVM/bridge/iOVM_L2CrossDomainMessenger.sol";
import { iOVM_L1ERC20Gateway } from "../../iOVM/bridge/ERC20/iOVM_L1ERC20Gateway.sol";

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
contract OVM_ETH is OVM_L2ERC20Gateway {
    constructor(
        address _l2CrossDomainMessenger,
        address _l1ERC20Gateway
    ) 
        OVM_L2ERC20Gateway(
            iOVM_L2CrossDomainMessenger(_l2CrossDomainMessenger),
            18, // WETH decimals
            "ovmWETH",
            "oWETH"
        )
        public 
    {
        init(iOVM_L1ERC20Gateway(_l1ERC20Gateway));
    }
}
