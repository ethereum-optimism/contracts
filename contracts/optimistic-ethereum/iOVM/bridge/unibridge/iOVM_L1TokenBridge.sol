// SPDX-License-Identifier: MIT
pragma solidity >0.5.0;
pragma experimental ABIEncoderV2;

/**
 * @title iOVM_L1TokenBridge
 */
interface iOVM_L1TokenBridge {

    /**********
     * Events *
     **********/

    event DepositInitiated(
        address indexed _token,
        address indexed _from,
        address _to,
        uint256 _amount
    );

    event WithdrawalFinalized(
        address indexed _token,
        address indexed _to,
        uint256 _amount
    );


    /********************
     * Public Functions *
     ********************/

    function depositAsERC20(
        address token,
        address _to,
        uint _amount
    ) external;

    function depositAsERC777(
        address _token,
        address _to,
        uint _amount
    ) external;

    /*************************
     * Cross-chain Functions *
     *************************/

    function finalizeWithdrawal(
        address _token,
        address _to,
        uint _amount
    )
        external;
}
