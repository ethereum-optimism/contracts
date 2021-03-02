// SPDX-License-Identifier: MIT
pragma solidity >0.5.0;
pragma experimental ABIEncoderV2;

/**
 * @title iOVM_L2TokenBridge
 */
interface iOVM_L2TokenBridge {

    /**********
     * Events *
     **********/

    event WithdrawalInitiated(
        address indexed _token,
        address indexed _from,
        address _to,
        uint256 _amount
    );

    event DepositFinalized(
        address indexed _token,
        address indexed _to,
        uint256 _amount
    );  


    /********************
     * Public Functions *
     ********************/

    function depositAsERC20(
        address _token,
        address _to,
        uint _amount,
        uint8 _decimals
    )
        external;

    function depositAsERC777(
        address _token,
        address _to,
        uint _amount,
        uint8 _decimals
    )
        external;


    function withdraw(
        address _l1Token,
        address _destination,
        uint _amount
    )
        external;

    function migrate(
        address _l1Token,
        address _target,
        address _recipient,
        uint256 _amount
    )
        external;

    function updateTokenInfo(
        address l1ERC20,
        string calldata name,
        string calldata symbol
    )
        external;

}
