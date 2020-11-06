// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.0;

/* Library Imports */
import { Lib_AddressResolver } from "./Lib_AddressResolver.sol";

/**
 * @title Lib_ResolvedDelegateProxy
 */
contract Lib_ResolvedDelegateProxy is Lib_AddressResolver {

    /*************
     * Variables *
     *************/

    string private name;


    /***************
     * Constructor *
     ***************/

    /**
     * @param _libAddressManager Address of the Lib_AddressManager.
     * @param _name Name of the contract to proxy to.
     */
    constructor(
        address _libAddressManager,
        string memory _name
    )
        Lib_AddressResolver(_libAddressManager)
    {
        name = _name;
    }


    /*********************
     * Fallback Function *
     *********************/

    fallback()
        external
    {
        address target = resolve(name);
        require(
            target != address(0),
            "Target address must be initialized."
        );

        (bool success, bytes memory returndata) = target.delegatecall(msg.data);
        
        if (success == true) {
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
