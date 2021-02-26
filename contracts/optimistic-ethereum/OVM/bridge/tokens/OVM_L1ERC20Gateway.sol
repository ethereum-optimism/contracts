// SPDX-License-Identifier: MIT
// @unsupported: ovm 
pragma solidity >0.5.0 <0.8.0;
pragma experimental ABIEncoderV2;

/* Interface Imports */
import { iOVM_L1ERC20Gateway } from "../../../iOVM/bridge/tokens/iOVM_L1ERC20Gateway.sol";
import { Abs_L1TokenGateway } from "./Abs_L1TokenGateway.sol";
// import { iOVM_L2DepositedERC20 } from "../../../iOVM/bridge/tokens/iOVM_L2DepositedERC20.sol";
import { iOVM_ERC20 } from "../../../iOVM/precompiles/iOVM_ERC20.sol";

/* Library Imports */
import { OVM_CrossDomainEnabled } from "../../../libraries/bridge/OVM_CrossDomainEnabled.sol";

/**
 * @title OVM_L1ERC20Gateway
 * @dev The L1 ERC20 Gateway is a contract which stores deposited L1 funds that are in use on L2.
 * It synchronizes a corresponding L2 ERC20 Gateway, informing it of deposits, and listening to it 
 * for newly finalized withdrawals.
 *
 * Compiler used: solc
 * Runtime target: EVM
 */
contract OVM_L1ERC20Gateway is Abs_L1TokenGateway {

    function _handleInitiateDeposit(
        address _from,
        address _to,
        uint256 _amount
    )
        internal
        override
    {
         // Hold on to the newly deposited funds
        l1ERC20.transferFrom(
            _from,
            address(this),
            _amount
        );
    }

    function _handleFinalizeWithdrawal(
        address _to,
        uint _amount
    )
        internal
        override
    {
        // Transfer withdrawn funds out to withdrawer
        l1ERC20.transfer(_to, _amount);
    }
    
    /********************************
     * External Contract References *
     ********************************/
    
    iOVM_ERC20 public l1ERC20;

    /***************
     * Constructor *
     ***************/

    /**
     * @param _l1ERC20 L1 ERC20 address this contract stores deposits for
     * @param _l2DepositedERC20 L2 Gateway address on the chain being deposited into
     */
    constructor(
        iOVM_ERC20 _l1ERC20,
        address _l2DepositedERC20,
        address _l1messenger 
    )
        Abs_L1TokenGateway(
            _l2DepositedERC20,
            _l1messenger
        )
    {
        l1ERC20 = _l1ERC20;
    }
}
