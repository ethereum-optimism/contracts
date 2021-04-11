// SPDX-License-Identifier: MIT
pragma solidity >0.5.0 <0.8.0;
pragma experimental ABIEncoderV2;

/* Contract Imports */
import { ERC721URIStorage } from "../optimistic-ethereum/libraries/standards/ERC721/extensions/ERC721URIStorage.sol";
import { ERC721 } from "../optimistic-ethereum/libraries/standards/ERC721/ERC721.sol";

/**
 * @title TestERC721
 * @dev A test ERC721 with tokenURI storage with an open mint function for testing
 */
contract TestERC721 is ERC721URIStorage {

    /***************
     * Constructor *
     ***************/

    /**
     * @param _name ERC721 name
     * @param _symbol ERC721 symbol
     */
    constructor(
        string memory _name,
        string memory _symbol
    )
        ERC721(_name, _symbol)
    {}

    function mint(address _to, uint256 _tokenId, string memory _tokenURI) public {
        _mint(_to, _tokenId);
        _setTokenURI(_tokenId, _tokenURI);
    }
}
