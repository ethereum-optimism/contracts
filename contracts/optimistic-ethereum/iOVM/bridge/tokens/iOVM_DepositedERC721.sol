// SPDX-License-Identifier: MIT
pragma solidity >0.5.0;
pragma experimental ABIEncoderV2;

/**
 * @title iOVM_DepositedERC721
 */
interface iOVM_DepositedERC721 {

    /**********
     * Events *
     **********/

    event WithdrawalInitiated(
        address indexed _from,
        address _to,
        uint256 _tokenId
    );

    event DepositFinalized(
        address indexed _to,
        uint256 _tokenId,
        string _tokenURI
    );


    /********************
     * Public Functions *
     ********************/

    function withdraw(
        uint _tokenId
    )
        external;

    function withdrawTo(
        address _to,
        uint _tokenId
    )
        external;


    /*************************
     * Cross-chain Functions *
     *************************/

    function finalizeDeposit(
        address _to,
        uint _tokenId,
        string memory _tokenURI
    )
        external;

}
