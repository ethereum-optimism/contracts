// SPDX-License-Identifier: MIT
pragma solidity >0.5.0 <0.8.0;
pragma experimental ABIEncoderV2;

/* Interface Imports */
import { IUniswapV2ERC20 } from "../../precompiles/IUniswapV2ERC20.sol";

/**
 * @title iOVM_L2ERC20Gateway
 */
interface iOVM_L2ERC20Gateway is IUniswapV2ERC20 {

    /**********
     * Events *
     **********/
    event WithdrawalInitiated(address indexed _from, address _to, uint256 _amount);
    event DepositFinalized(address indexed _to, uint256 _amount);    

    /********************
     * Public Functions *
     ********************/
    function withdraw(uint _amount) external;
    function withdrawTo(address _to, uint _amount) external;
    
    /*************************
     * Cross-chain Functions *
     *************************/
    function finalizeDeposit(address _to, uint _amount) external;
}