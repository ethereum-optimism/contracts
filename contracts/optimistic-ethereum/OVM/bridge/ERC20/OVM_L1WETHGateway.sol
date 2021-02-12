// SPDX-License-Identifier: MIT
// @unsupported: ovm 
// @todo: remove this
pragma solidity >0.5.0 <0.8.0;
pragma experimental ABIEncoderV2;

/* Interface Imports */
import {iOVM_ERC20 } from "../../../iOVM/precompiles/iOVM_ERC20.sol";
import { iAbs_BaseCrossDomainMessenger } from "../../../iOVM/bridge/iAbs_BaseCrossDomainMessenger.sol";

/* Library Imports */
import { Lib_AddressResolver } from "../../../libraries/resolver/Lib_AddressResolver.sol";

/* Contract Imports */
import { OVM_L1ERC20Gateway } from "./OVM_L1ERC20Gateway.sol";

/**
 * @title OVM_L1WETHGateway
 * @dev @todo
 *
 * Compiler used: solc
 * Runtime target: EVM
 */
contract OVM_L1WETHGateway is Lib_AddressResolver, OVM_L1ERC20Gateway {
    constructor(
        iOVM_ERC20 _l1WETH,
        address _l2ERC20Gateway,
        address _libAddressManager
    ) 
        Lib_AddressResolver(_libAddressManager)
        OVM_L1ERC20Gateway(
            _l1WETH,
            _l2ERC20Gateway,
            iAbs_BaseCrossDomainMessenger(
                resolve("OVM_L2CrossDomainMessenger")
            )
        )
    { }
}