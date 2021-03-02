// SPDX-License-Identifier: MIT

pragma solidity >0.5.0 <0.8.0;

/* Interface Imports */
import { IERC777 } from "@openzeppelin/contracts/token/ERC777/IERC777.sol";
import { IERC777Recipient } from "@openzeppelin/contracts/token/ERC777/IERC777Recipient.sol";
import { IERC777Sender } from "@openzeppelin/contracts/token/ERC777/IERC777Sender.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { iOVM_L2TokenBridge } from "../../../iOVM/bridge/unibridge/iOVM_L2TokenBridge.sol";

/* Library Imports */
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { IERC1820Registry } from "@openzeppelin/contracts/introspection/IERC1820Registry.sol";

/**
 * @title OVM_L2ERC777
 * @dev The L2 Deposited ERC777 is an ERC777 implementation which represents L1 assets deposited into L2.
 * This contract mints new tokens when the token bridge receives deposit messages.
 * This contract also burns the tokens intended for withdrawal and calls the bridge contract.
 * The name & symbol will be empty by default, and can be set by calling updateTokenInfo on the L1 bridge.
 *
 * This contract is a modified version of the OpenZeppelin ERC777 contract, which removes unnecessary features.
 *
 * Compiler used: optimistic-solc
 * Runtime target: OVM
 */
contract OVM_L2ERC777 is IERC777, IERC20 {
    using Address for address;


    /********************************
     * External Contract References *
     ********************************/

    address public immutable bridge;
    address public l1Address;
    uint8 public l1Decimals;

    IERC1820Registry constant internal _ERC1820_REGISTRY = IERC1820Registry(0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24);


    /**********************
     * Contract Variables *
     **********************/

    mapping(address => uint256) private _balances;

    uint256 private _totalSupply;
    string private _name;
    string private _symbol;
    uint256 private _granularity;

    // For each account, a mapping of its operators and revoked bridge operators.
    mapping(address => mapping(address => bool)) private _operators;

    // ERC20-allowances
    mapping (address => mapping (address => uint256)) private _allowances;

    bytes32 private constant _TOKENS_SENDER_INTERFACE_HASH = keccak256("ERC777TokensSender");
    bytes32 private constant _TOKENS_RECIPIENT_INTERFACE_HASH = keccak256("ERC777TokensRecipient");


    /********************************
     * Constructor & Initialization *
     ********************************/

    constructor() public {
        bridge = msg.sender;

        // register interfaces
        _ERC1820_REGISTRY.setInterfaceImplementer(address(this), keccak256("ERC777Token"), address(this));
        _ERC1820_REGISTRY.setInterfaceImplementer(address(this), keccak256("ERC20Token"), address(this));
    }

    function initialize(address _l1Address, uint8 _decimals) external onlyBridge {
        require(_decimals <= 18);
        l1Address = _l1Address;
        l1Decimals = _decimals;
        _granularity = 10 ** uint256(18 - _decimals);
    }

    /**********************
     * Function Modifiers *
     **********************/

    modifier onlyBridge {
        require(msg.sender == bridge, "May only be called by the bridge");
        _;
    }

    /******************
     * View Functions *
     ******************/

    function name() public view virtual override returns (string memory) {
        return _name;
    }

    function symbol() public view virtual override returns (string memory) {
        return _symbol;
    }

    /**
     * @dev See {ERC20-decimals}.
     *
     * Always returns 18, as per the
     * [ERC777 EIP](https://eips.ethereum.org/EIPS/eip-777#backward-compatibility).
     */
    function decimals() public pure virtual returns (uint8) {
        return 18;
    }

    /**
     * @dev The smallest unit that can be transferred or minted. Derived from the number of decimals.
     */
    function granularity() public view virtual override returns (uint256) {
        return _granularity;
    }

    /**
     * @dev See {IERC777-totalSupply}.
     */
    function totalSupply() public view virtual override(IERC20, IERC777) returns (uint256) {
        return _totalSupply;
    }

    /**
     * @dev Returns the amount of tokens owned by an account (`tokenHolder`).
     */
    function balanceOf(address tokenHolder) public view virtual override(IERC20, IERC777) returns (uint256) {
        return _balances[tokenHolder];
    }

    /*******************
     * Token Transfers *
     *******************/ 

    /**
     * @dev See {IERC777-send}.
     *
     * Also emits a {IERC20-Transfer} event for ERC20 compatibility.
     */
    function send(address recipient, uint256 amount, bytes memory data) public virtual override  {
        _send(msg.sender, recipient, amount, data, "", true);
    }

    /**
     * @dev See {IERC20-transfer}.
     *
     * Unlike `send`, `recipient` is _not_ required to implement the {IERC777Recipient}
     * interface if it is a contract.
     *
     * Also emits a {Sent} event.
     */
    function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
        require(recipient != address(0), "ERC777: transfer to the zero address");

        address from = msg.sender;

        _callTokensToSend(from, from, recipient, amount, "", "");

        _move(from, from, recipient, amount, "", "");

        _callTokensReceived(from, from, recipient, amount, "", "", false);

        return true;
    }

    /*************
     * Operators *
     *************/ 

    /**
     * @dev See {IERC777-isOperatorFor}.
     */
    function isOperatorFor(address operator, address tokenHolder) public view virtual override returns (bool) {
        return operator == tokenHolder || _operators[tokenHolder][operator];
    }

    /**
     * @dev See {IERC777-authorizeOperator}.
     */
    function authorizeOperator(address operator) public virtual override  {
        require(msg.sender != operator, "ERC777: authorizing self as operator");

        _operators[msg.sender][operator] = true;

        emit AuthorizedOperator(operator, msg.sender);
    }

    /**
     * @dev See {IERC777-revokeOperator}.
     */
    function revokeOperator(address operator) public virtual override  {
        require(operator != msg.sender, "ERC777: revoking self as operator");

        delete _operators[msg.sender][operator];

        emit RevokedOperator(operator, msg.sender);
    }

    /**
     * @dev See {IERC777-defaultOperators}.
     */
    function defaultOperators() public view virtual override returns (address[] memory _defaultOperators) {
        _defaultOperators = new address[](0);
    }

    /**
     * @dev See {IERC777-operatorSend}.
     *
     * Emits {Sent} and {IERC20-Transfer} events.
     */
    function operatorSend(
        address sender,
        address recipient,
        uint256 amount,
        bytes memory data,
        bytes memory operatorData
    )
        public
        virtual
        override
    {
        require(isOperatorFor(msg.sender, sender), "ERC777: caller is not an operator for holder");
        _send(sender, recipient, amount, data, operatorData, true);
    }

    /**
     * @dev See {IERC777-operatorBurn}.
     *
     * Emits {Burned} and {IERC20-Transfer} events.
     */
    function operatorBurn(address account, uint256 amount, bytes memory data, bytes memory operatorData) public virtual override {
        require(isOperatorFor(msg.sender, account), "ERC777: caller is not an operator for holder");
        _burn(account, amount, data, operatorData);
    }

    /**************
     * Allowances *
     **************/ 

    /**
     * @dev See {IERC20-allowance}.
     *
     * Note that operator and allowance concepts are orthogonal: operators may
     * not have allowance, and accounts with allowance may not be operators
     * themselves.
     */
    function allowance(address holder, address spender) public view virtual override returns (uint256) {
        return _allowances[holder][spender];
    }

    /**
     * @dev See {IERC20-approve}.
     *
     * Note that accounts cannot have allowance issued by their operators.
     */
    function approve(address spender, uint256 value) public virtual override returns (bool) {
        address holder = msg.sender;
        _approve(holder, spender, value);
        return true;
    }

   /**
    * @dev See {IERC20-transferFrom}.
    *
    * Note that operator and allowance concepts are orthogonal: operators cannot
    * call `transferFrom` (unless they have allowance), and accounts with
    * allowance cannot call `operatorSend` (unless they are operators).
    *
    * Emits {Sent}, {IERC20-Transfer} and {IERC20-Approval} events.
    */
    function transferFrom(address holder, address recipient, uint256 amount) public virtual override returns (bool) {
        require(recipient != address(0), "ERC777: transfer to the zero address");
        require(holder != address(0), "ERC777: transfer from the zero address");

        address spender = msg.sender;

        _callTokensToSend(spender, holder, recipient, amount, "", "");

        _move(spender, holder, recipient, amount, "", "");

        uint256 currentAllowance = _allowances[holder][spender];
        require(currentAllowance >= amount, "ERC777: transfer amount exceeds allowance");
        _approve(holder, spender, currentAllowance - amount);

        _callTokensReceived(spender, holder, recipient, amount, "", "", false);

        return true;
    }

    /*************************
     * User Bridge functions *
     *************************/ 

    /**
     * @dev initiate a withdraw of some ERC20 to a recipient's account on L1
     * @param _destination L1 address to credit the withdrawal to
     * @param _amount Amount of tokens to withdraw (with ERC777 decimals)
     */
    function withdraw(address _destination, uint256 _amount) external {
        _burn(msg.sender, _amount, "", "");
        iOVM_L2TokenBridge(bridge).withdraw(l1Address, _destination, from777to20(l1Decimals, _amount));
    }

    /**
     * @dev initiate a withdraw of some ERC20 to a recipient's account on L1
     * @param _amount Amount of tokens to migrate (with ERC777 decimals)
     * @param _target The token to migrate to (should be the ERC20 version)
     */
    function migrate(uint256 _amount, address _target) external {
        _burn(msg.sender, _amount, "", "");
        iOVM_L2TokenBridge(bridge).migrate(l1Address, _target, msg.sender, from777to20(l1Decimals, _amount));
    }

    /********************
     * Bridge functions *
     ********************/ 

    /**
     * @dev Called by the bridge to mint new tokens
     * @param _destination address to mint tokens to
     * @param _amount Amount of tokens to mint (ERC20 units)
     */
    function mint(address _destination, uint256 _amount) external onlyBridge {
        _mint(_destination, from20to777(l1Decimals, _amount), '', '');
    }

    function updateInfo(string memory _newName, string memory _newSymbol) external onlyBridge {
        _name = _newName;
        _symbol = _newSymbol;
    }

    /*********************
     * Private functions *
     *********************/ 

    /**
     * @dev Creates `amount` tokens and assigns them to `account`, increasing
     * the total supply.
     *
     * If a send hook is registered for `account`, the corresponding function
     * will be called with `operator`, `data` and `operatorData`.
     *
     * See {IERC777Sender} and {IERC777Recipient}.
     *
     * Emits {Minted} and {IERC20-Transfer} events.
     *
     */
    function _mint(
        address account,
        uint256 amount,
        bytes memory userData,
        bytes memory operatorData
    )
        internal
        virtual
    {
        require(account != address(0), "ERC777: mint to the zero address");

        address operator = msg.sender;

        // Update state variables
        _totalSupply += amount;
        _balances[account] += amount;

        // Note: The ERC777 specification & OpenZeppelin implementation set requireReceptionAck
        // to true for _mint. However, here it has been changed to false to prevent deposit failures.
        _callTokensReceived(operator, address(0), account, amount, userData, operatorData, true);

        emit Minted(operator, account, amount, userData, operatorData);
        emit Transfer(address(0), account, amount);
    }

    /**
     * @dev Send tokens
     * @param from address token holder address
     * @param to address recipient address
     * @param amount uint256 amount of tokens to transfer
     * @param userData bytes extra information provided by the token holder (if any)
     * @param operatorData bytes extra information provided by the operator (if any)
     * @param requireReceptionAck if true, contract recipients are required to implement ERC777TokensRecipient
     */
    function _send(
        address from,
        address to,
        uint256 amount,
        bytes memory userData,
        bytes memory operatorData,
        bool requireReceptionAck
    )
        internal
        virtual
    {
        require(from != address(0), "ERC777: send from the zero address");
        require(to != address(0), "ERC777: send to the zero address");

        address operator = msg.sender;

        _callTokensToSend(operator, from, to, amount, userData, operatorData);

        _move(operator, from, to, amount, userData, operatorData);

        _callTokensReceived(operator, from, to, amount, userData, operatorData, requireReceptionAck);
    }

    /**
     * @dev Burn tokens
     * @param from address token holder address
     * @param amount uint256 amount of tokens to burn
     * @param data bytes extra information provided by the token holder
     * @param operatorData bytes extra information provided by the operator (if any)
     */
    function _burn(
        address from,
        uint256 amount,
        bytes memory data,
        bytes memory operatorData
    )
        internal
        virtual
    {
        require(from != address(0), "ERC777: burn from the zero address");

        address operator = msg.sender;

        _callTokensToSend(operator, from, address(0), amount, data, operatorData);

        // Update state variables
        uint256 fromBalance = _balances[from];
        require(fromBalance >= amount, "ERC777: burn amount exceeds balance");
        _balances[from] = fromBalance - amount;
        _totalSupply -= amount;

        emit Burned(operator, from, amount, data, operatorData);
        emit Transfer(from, address(0), amount);
    }

    function _move(
        address operator,
        address from,
        address to,
        uint256 amount,
        bytes memory userData,
        bytes memory operatorData
    )
        private
    {
        uint256 fromBalance = _balances[from];
        require(fromBalance >= amount, "ERC777: transfer amount exceeds balance");
        _balances[from] = fromBalance - amount;
        _balances[to] += amount;

        emit Sent(operator, from, to, amount, userData, operatorData);
        emit Transfer(from, to, amount);
    }

    /**
     * @dev See {ERC20-_approve}.
     *
     * Note that accounts cannot have allowance issued by their operators.
     */
    function _approve(address holder, address spender, uint256 value) internal {
        require(holder != address(0), "ERC777: approve from the zero address");
        require(spender != address(0), "ERC777: approve to the zero address");

        _allowances[holder][spender] = value;
        emit Approval(holder, spender, value);
    }

    /**
     * @dev Call from.tokensToSend() if the interface is registered
     * @param operator address operator requesting the transfer
     * @param from address token holder address
     * @param to address recipient address
     * @param amount uint256 amount of tokens to transfer
     * @param userData bytes extra information provided by the token holder (if any)
     * @param operatorData bytes extra information provided by the operator (if any)
     */
    function _callTokensToSend(
        address operator,
        address from,
        address to,
        uint256 amount,
        bytes memory userData,
        bytes memory operatorData
    )
        private
    {
        address implementer = _ERC1820_REGISTRY.getInterfaceImplementer(from, _TOKENS_SENDER_INTERFACE_HASH);
        if (implementer != address(0)) {
            IERC777Sender(implementer).tokensToSend(operator, from, to, amount, userData, operatorData);
        }
    }

    /**
     * @dev Call to.tokensReceived() if the interface is registered. Reverts if the recipient is a contract but
     * tokensReceived() was not registered for the recipient
     * @param operator address operator requesting the transfer
     * @param from address token holder address
     * @param to address recipient address
     * @param amount uint256 amount of tokens to transfer
     * @param userData bytes extra information provided by the token holder (if any)
     * @param operatorData bytes extra information provided by the operator (if any)
     * @param requireReceptionAck if true, contract recipients are required to implement ERC777TokensRecipient
     */
    function _callTokensReceived(
        address operator,
        address from,
        address to,
        uint256 amount,
        bytes memory userData,
        bytes memory operatorData,
        bool requireReceptionAck
    )
        private
    {
        address implementer = _ERC1820_REGISTRY.getInterfaceImplementer(to, _TOKENS_RECIPIENT_INTERFACE_HASH);
        if (implementer != address(0)) {
            IERC777Recipient(implementer).tokensReceived(operator, from, to, amount, userData, operatorData);
        } else if (requireReceptionAck) {
            require(!to.isContract(), "ERC777: token recipient contract has no implementer for ERC777TokensRecipient");
        }
    }

    function from777to20(uint8 _decimals, uint amount) internal pure returns (uint256) {
        require(_decimals <= 18, 'DEC');
        return amount / (10 ** uint256(18 - _decimals));
    }

    function from20to777(uint8 _decimals, uint amount) internal pure returns (uint256) {
        require(_decimals <= 18, 'DEC');
        return amount * (10 ** uint256(18 - _decimals));
    }
}
