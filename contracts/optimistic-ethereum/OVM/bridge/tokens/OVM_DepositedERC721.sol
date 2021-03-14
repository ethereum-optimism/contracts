// SPDX-License-Identifier: MIT
pragma solidity >0.5.0 <0.8.0;
pragma experimental ABIEncoderV2;

/* Interface Imports */
import { iOVM_ERC721Gateway } from "../../../iOVM/bridge/tokens/iOVM_ERC721Gateway.sol";

/* Contract Imports */
import { ERC721URIStorage } from "../../../libraries/standards/ERC721/extensions/ERC721URIStorage.sol";
import { ERC721 } from "../../../libraries/standards/ERC721/ERC721.sol";

/* Library Imports */
import { Abs_DepositedERC721 } from "./Abs_DepositedERC721.sol";

/**
 * @title OVM_DepositedERC721
 * @dev The Deposited ERC721 is an ERC721 implementation which represents assets deposited on the other side of an Optimistic bridge.
 * This contract mints new tokens when it hears about deposits into the corresponding gateway.
 * This contract also burns the tokens intended for withdrawal, informing the gateway to release funds.
 *
 * NOTE: This contract implements the Abs_DepositedERC721 contract using OpenZeppelin's ERC20 as the implementation.
 * Alternative implementations can be used in this similar manner.
 *
 * Compiler used: optimistic-solc
 * Runtime target: OVM, EVM
 */
abstract contract OVM_DepositedERC721 is Abs_DepositedERC721, ERC721URIStorage {

    /***************
     * Constructor *
     ***************/

    /**
     * @param _messenger Cross-domain messenger used by this contract.
     * @param _name ERC721 name
     * @param _symbol ERC721 symbol
     */
    constructor(
        address _messenger,
        string memory _name,
        string memory _symbol
    )
        Abs_DepositedERC721(_messenger)
        ERC721(_name, _symbol)
    {}

    // When a withdrawal is initiated, we burn the withdrawer's token to prevent subsequent usage.
    function _handleInitiateWithdrawal(
        address, // _to,
        uint _tokenId
    )
        internal
        override
    {
        _burn(_tokenId);
    }

    // When a deposit is finalized, we mint a new token to the designated account
    function _handleFinalizeDeposit(
        address _to,
        uint _tokenId,
        string memory _tokenURI
    )
        internal
        override
    {
        _mint(_to, _tokenId);
        _setTokenURI(_tokenId, _tokenURI);

    }
}
