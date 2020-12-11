// SPDX-License-Identifier: MIT
// +build ovm
pragma solidity >0.6.0 <0.8.0;

/* Library Imports */
import { OVM_AddressManager } from "./OVM_AddressManager.sol";

/**
 * @title OVM_AddressResolver
 */
contract OVM_AddressResolver {

    /*******************************************
     * Contract Variables: Contract References *
     *******************************************/

    OVM_AddressManager internal ovmAddressManager;


    /***************
     * Constructor *
     ***************/

    /**
     * @param _ovmAddressManager Address of the OVM_AddressManager.
     */
    constructor(
        address _ovmAddressManager
    ) public {
        ovmAddressManager = OVM_AddressManager(_ovmAddressManager);
    }


    /********************
     * Public Functions *
     ********************/

    function resolve(
        string memory _name
    )
        public
        view
        returns (
            address _contract
        )
    {
        return ovmAddressManager.getAddress(_name);
    }
}
