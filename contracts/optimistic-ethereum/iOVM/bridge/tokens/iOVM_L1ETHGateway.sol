// SPDX-License-Identifier: MIT
pragma solidity >0.5.0;
pragma experimental ABIEncoderV2;

import { iOVM_L1TokenGateway } from "./iOVM_L1TokenGateway.sol";

/**
 * @title iOVM_L1ETHGateway
 */
interface iOVM_L1ETHGateway is iOVM_L1TokenGateway {

    /********************
     * Public Functions *
     ********************/

    function deposit()
        external
        payable;

    function depositTo(
        address _to
    )
        external
        payable;
}
