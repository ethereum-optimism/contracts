// SPDX-License-Identifier: MIT
pragma solidity >0.5.0 <0.8.0;
pragma experimental ABIEncoderV2;

/* Interface Imports */
import { iOVM_L2TokenBridge } from "../../../iOVM/bridge/unibridge/iOVM_L2TokenBridge.sol";

/* Contract Imports */
import { UniswapV2ERC20 } from "../../../libraries/standards/UniswapV2ERC20.sol";

/**
 * @title OVM_L2ERC20
 * @dev The L2 Deposited ERC20 is an ERC20 implementation which represents L1 assets deposited into L2.
 * This contract mints new tokens when the token bridge receives deposit messages.
 * This contract also burns the tokens intended for withdrawal and calls the bridge contract.
 * The name & symbol will be empty by default, and can be set by calling updateTokenInfo on the L1 bridge.
 *
 * Compiler used: optimistic-solc
 * Runtime target: OVM
 */
contract OVM_L2ERC20 is UniswapV2ERC20 {
    /********************************
     * External Contract References *
     ********************************/

    address public immutable bridge;
    address public l1Address;

    /********************************
     * Constructor & Initialization *
     ********************************/

    constructor() public UniswapV2ERC20(0, "", "") {
        bridge = msg.sender;
    }

    /**
     * @dev Initialize the contract immediately after construction, passing in the
     * L1 token address and the number of decimals. 
     *
     * @param _l1Address Address of the corresponding token on L1
     * @param _decimals Number of decimal places of the token
     */
    function initialize(address _l1Address, uint8 _decimals) external onlyBridge {
        l1Address = _l1Address;
        decimals = _decimals;
    }

    /**********************
     * Function Modifiers *
     **********************/

    modifier onlyBridge {
        require(msg.sender == bridge, "May only be called by the bridge");
        _;
    }

    /******************
     * User Functions *
     ******************/

    /**
     * @dev Initiate a withdraw of some ERC20 to a recipient's account on L1
     * @param _destination L1 adress to credit the withdrawal to
     * @param _amount Amount of the ERC20 to withdraw
     */
    function withdraw(address _destination, uint256 _amount) external {
        _burn(msg.sender, _amount);
        iOVM_L2TokenBridge(bridge).withdraw(l1Address, _destination, _amount);
    }

    /**
     * @dev Migrate tokens from ERC20 to ERC777
     * @param _amount Amount of the ERC20 to migrate
     * @param _target The address of the ERC777 token
     */
    function migrate(uint256 _amount, address _target) external {
        _burn(msg.sender, _amount);
        iOVM_L2TokenBridge(bridge).migrate(l1Address, _target, msg.sender, _amount);
    }

    /********************
     * Bridge functions *
     ********************/ 

    /**
     * @dev Receives the name & symbol of the token from the bridge.
     *
     * @param _newName The token's name
     * @param _newSymbol The token's symbol
     */
    function updateInfo(string memory _newName, string memory _newSymbol) external onlyBridge {
        name = _newName;
        symbol = _newSymbol;
    }

    /**
     * @dev Mints new tokens to a user.
     *
     * @param _recipient The address to receive the tokens.
     * @param _amount The amount of tokens to mint.
     */
    function mint(address _recipient, uint256 _amount) external onlyBridge {
        _mint(_recipient, _amount);
    }
}
