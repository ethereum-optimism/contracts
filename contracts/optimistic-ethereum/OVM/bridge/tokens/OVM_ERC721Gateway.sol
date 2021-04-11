// SPDX-License-Identifier: MIT
pragma solidity >0.5.0 <0.8.0;
pragma experimental ABIEncoderV2;

/* Interface Imports */
import { iOVM_ERC721Gateway } from "../../../iOVM/bridge/tokens/iOVM_ERC721Gateway.sol";
import { Abs_ERC721Gateway } from "./Abs_ERC721Gateway.sol";
import { IERC721 } from "../../../libraries/standards/ERC721/IERC721.sol";

/**
* @title OVM_ERC721Gateway
* @dev An ERC721 Gateway is a contract which stores deposited ERC721 tokens that
* are in use on the other side of the bridge.
* It synchronizes a corresponding representation of the "deposited token" on
* the other side, informing it of new deposits and releasing tokens when there
* are newly finalized withdrawals.
*
* NOTE: This contract extends Abs_ERC721Gateway, which is where we
* takes care of most of the initialization and the cross-chain logic.
* If you are looking to implement your own deposit/withdrawal contracts, you
* may also want to extend the abstract contract in a similar manner.
*
* Compiler used: solc, optimistic-solc
* Runtime target: EVM or OVM
 */
contract OVM_ERC721Gateway is Abs_ERC721Gateway {

    /***************
     * Constructor *
     ***************/

    /**
     * @param _ERC721 ERC721 address this gateway stores deposits for
     * @param _depositedERC721 iOVM_DepositedERC721-compatible address on the chain being deposited into.
     * @param _messenger messenger address being used for cross-chain communications.
     */
    constructor(
        address _ERC721,
        address _depositedERC721,
        address _messenger
    )
        Abs_ERC721Gateway(
            _ERC721,
            _depositedERC721,
            _messenger
        )
    {}


    /**************
     * Accounting *
     **************/

    /**
     * @dev When a deposit is initiated, the Gateway
     * transfers the funds to itself for future withdrawals
     *
     * @param _from address the ERC721 is being deposited from
     * param _to address that the ERC721 is being deposited to
     * @param _tokenId the ERC721 being deposited
     */
    function _handleInitiateDeposit(
        address _from,
        address, // _to,
        uint256 _tokenId
    )
        internal
        override
    {
         // Hold on to the newly deposited funds
        IERC721(originalToken).transferFrom(
            _from,
            address(this),
            _tokenId
        );
    }

    /**
     * @dev When a withdrawal is finalized, the Gateway
     * transfers the funds to the withdrawer
     *
     * @param _to address that the ERC721 is being withdrawn to
     * @param _tokenId the ERC721 being withdrawn
     */
    function _handleFinalizeWithdrawal(
        address _to,
        uint _tokenId
    )
        internal
        override
    {
        // Transfer withdrawn funds out to withdrawer
        IERC721(originalToken).transferFrom(address(this), _to, _tokenId);
    }
}
