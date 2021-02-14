// SPDX-License-Identifier: MIT
// @unsupported: ovm
// @todo: remove this
pragma solidity >0.5.0 <0.8.0;
pragma experimental ABIEncoderV2;

/* Interface Imports */
import {
    iOVM_L1ETHGateway
} from "../../../iOVM/bridge/ETH/iOVM_L1ETHGateway.sol";
import {
    iOVM_L2ERC20Gateway
} from "../../../iOVM/bridge/ERC20/iOVM_L2ERC20Gateway.sol";
import {
    iAbs_BaseCrossDomainMessenger
} from "../../../iOVM/bridge/iAbs_BaseCrossDomainMessenger.sol";
import {iOVM_ERC20} from "../../../iOVM/precompiles/iOVM_ERC20.sol";

/* Library Imports */
import {OVM_CrossChainEnabled} from "../OVM_CrossChainEnabled.sol";

/**
 * @title OVM_L1ETHGateway
 * @dev The L1 ETH Gateway is a contract which stores deposited ETH that is in use on L2.
 *
 * Compiler used: solc
 * Runtime target: EVM
 */
contract OVM_L1ETHGateway is iOVM_L1ETHGateway, OVM_CrossChainEnabled {
    /********************************
     * External Contract References *
     ********************************/

    address public l2ERC20Gateway;

    /***************
     * Constructor *
     ***************/

    /**
     * @param _l2ERC20Gateway L2 Gateway address on the chain being deposited into
     * @param _l1messenger L1 Messenger address being used for cross-chain communications.
     */
    constructor(
        address _l2ERC20Gateway,
        iAbs_BaseCrossDomainMessenger _l1messenger
    ) OVM_CrossChainEnabled(_l1messenger) {
        l2ERC20Gateway = _l2ERC20Gateway;
    }

    /**************
     * Depositing *
     **************/

    /**
     * @dev deposit an amount of the ERC20 to the caller's balance on L2
     */
    function deposit() external override payable {
        _initiateDeposit(msg.sender, msg.sender);
    }

    /**
     * @dev deposit an amount of ERC20 to a recipients's balance on L2
     * @param _to L2 address to credit the withdrawal to
     */
    function depositTo(address _to) external override payable {
        _initiateDeposit(msg.sender, _to);
    }

    /**
     * @dev Performs the logic for deposits by storing the ERC20 and informing the L2 ERC20 Gateway of the deposit.
     *
     * @param _from Account to pull the deposit from on L1
     * @param _to Account to give the deposit to on L2
     */
    function _initiateDeposit(
        address _from,
        address _to
    ) internal {

        // Construct calldata for l2ERC20Gateway.finalizeDeposit(_to, _amount)
        bytes memory data =
            abi.encodeWithSelector(
                iOVM_L2ERC20Gateway.finalizeDeposit.selector,
                _to,
                msg.value
            );

        // Send calldata into L2
        sendCrossDomainMessage(
            l2ERC20Gateway,
            data,
            1000000 // TODO: meter and set with some buffer
        );

        emit DepositInitiated(_from, _to, msg.value);
    }

    /*************************************
     * Cross-chain Function: Withdrawing *
     *************************************/

    /**
     * @dev Complete a withdrawal from L2 to L1, and credit funds to the recipient's balance of the
     * L1 ERC20 token.
     * This call will fail if the initialized withdrawal from L2 has not been finalized.
     *
     * @param _to L1 address to credit the withdrawal to
     * @param _amount Amount of the ERC20 to withdraw
     */
    function finalizeWithdrawal(address _to, uint256 _amount)
        external
        override
        onlyFromCrossDomainAccount(l2ERC20Gateway)
    {
        _safeTransferETH(_to, _amount);

        emit WithdrawalFinalized(_to, _amount);
    }

    function _safeTransferETH(address to, uint256 value) internal {
        (bool success, ) = to.call{value: value}(new bytes(0));
        require(success, 'TransferHelper::safeTransferETH: ETH transfer failed');
    }

    receive() external payable {
    }
}
