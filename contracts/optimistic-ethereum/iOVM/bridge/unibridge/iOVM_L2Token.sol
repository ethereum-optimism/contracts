// SPDX-License-Identifier: MIT
pragma solidity >0.5.0;
pragma experimental ABIEncoderV2;

/**
 * @title iOVM_L2Token
 */
interface iOVM_L2Token {
    function initialize(address _l1Address, uint8 _decimals) external;

    function updateInfo(string memory newName, string memory newSymbol) external;

    function withdraw(address _destination, uint256 _amount) external;

    function migrate(uint256 amount, address target) external;

    function mint(address recipient, uint256 amount) external;
}
