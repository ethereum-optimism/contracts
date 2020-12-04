// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

/* Library Imports */
import { Lib_OVMCodec } from "../../libraries/codec/Lib_OVMCodec.sol";
import { Lib_AddressResolver } from "../../libraries/resolver/Lib_AddressResolver.sol";
import { Lib_EthUtils } from "../../libraries/utils/Lib_EthUtils.sol";
import { Lib_Bytes32Utils } from "../../libraries/utils/Lib_Bytes32Utils.sol";
import { Lib_BytesUtils } from "../../libraries/utils/Lib_BytesUtils.sol";
import { Lib_SecureMerkleTrie } from "../../libraries/trie/Lib_SecureMerkleTrie.sol";
import { Lib_RLPWriter } from "../../libraries/rlp/Lib_RLPWriter.sol";
import { Lib_RLPReader } from "../../libraries/rlp/Lib_RLPReader.sol";

/* Interface Imports */
import { iOVM_StateTransitioner } from "../../iOVM/verification/iOVM_StateTransitioner.sol";
import { iOVM_BondManager } from "../../iOVM/verification/iOVM_BondManager.sol";
import { iOVM_ExecutionManager } from "../../iOVM/execution/iOVM_ExecutionManager.sol";
import { iOVM_StateManager } from "../../iOVM/execution/iOVM_StateManager.sol";
import { iOVM_StateManagerFactory } from "../../iOVM/execution/iOVM_StateManagerFactory.sol";

/* Contract Imports */
import { OVM_FraudContributor } from "./OVM_FraudContributor.sol";

/**
 * @title OVM_StateTransitioner
 */
contract OVM_StateTransitioner is Lib_AddressResolver, OVM_FraudContributor, iOVM_StateTransitioner {

    /*******************
     * Data Structures *
     *******************/

    enum TransitionPhase {
        PRE_EXECUTION,
        POST_EXECUTION,
        COMPLETE
    }


    /*******************************************
     * Contract Variables: Contract References *
     *******************************************/

    iOVM_StateManager public ovmStateManager;


    /*******************************************
     * Contract Variables: Internal Accounting *
     *******************************************/

    bytes32 internal preStateRoot;
    bytes32 internal postStateRoot;
    TransitionPhase public phase;
    uint256 internal stateTransitionIndex;
    bytes32 internal transactionHash;


    /*************
     * Constants *
     *************/

    bytes32 internal constant EMPTY_ACCOUNT_CODE_HASH = 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470;
    bytes32 internal constant EMPTY_ACCOUNT_STORAGE_ROOT = 0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421;


    /***************
     * Constructor *
     ***************/

    /**
     * @param _libAddressManager Address of the Address Manager.
     * @param _stateTransitionIndex Index of the state transition being verified.
     * @param _preStateRoot State root before the transition was executed.
     * @param _transactionHash Hash of the executed transaction.
     */
    constructor(
        address _libAddressManager,
        uint256 _stateTransitionIndex,
        bytes32 _preStateRoot,
        bytes32 _transactionHash
    )
        Lib_AddressResolver(_libAddressManager)
    {
        stateTransitionIndex = _stateTransitionIndex;
        preStateRoot = _preStateRoot;
        postStateRoot = _preStateRoot;
        transactionHash = _transactionHash;

        ovmStateManager = iOVM_StateManagerFactory(resolve("OVM_StateManagerFactory")).create(address(this));
    }


    /**********************
     * Function Modifiers *
     **********************/

    /**
     * Checks that a function is only run during a specific phase.
     * @param _phase Phase the function must run within.
     */
    modifier onlyDuringPhase(
        TransitionPhase _phase
    ) {
        require(
            phase == _phase,
            "Function must be called during the correct phase."
        );
        _;
    }


    /**********************************
     * Public Functions: State Access *
     **********************************/

    /**
     * Retrieves the state root before execution.
     * @return _preStateRoot State root before execution.
     */
    function getPreStateRoot()
        override
        public
        view
        returns (
            bytes32 _preStateRoot
        )
    {
        return preStateRoot;
    }

    /**
     * Retrieves the state root after execution.
     * @return _postStateRoot State root after execution.
     */
    function getPostStateRoot()
        override
        public
        view
        returns (
            bytes32 _postStateRoot
        )
    {
        return postStateRoot;
    }

    /**
     * Checks whether the transitioner is complete.
     * @return _complete Whether or not the transition process is finished.
     */
    function isComplete()
        override
        public
        view
        returns (
            bool _complete
        )
    {
        return phase == TransitionPhase.COMPLETE;
    }
    

    /***********************************
     * Public Functions: Pre-Execution *
     ***********************************/

    /**
     * Allows a user to prove the initial state of a contract.
     * @param _ovmContractAddress Address of the contract on the OVM.
     * @param _account Claimed account state.
     * @param _stateTrieWitness Proof of the account state.
     */
    function proveContractState(
        address _ovmContractAddress,
        address _ethContractAddress,
        Lib_OVMCodec.EVMAccount memory _account,
        bytes memory _stateTrieWitness
    )
        override
        public
        onlyDuringPhase(TransitionPhase.PRE_EXECUTION)
        contributesToFraudProof(preStateRoot, transactionHash)
    {
        // Exit quickly to avoid unnecessary work.
        require(
            ovmStateManager.hasAccount(_ovmContractAddress) == false,
            "Account state has already been proven"
        );

        address ethContractAddress = _ethContractAddress;
        if (_account.codeHash == EMPTY_ACCOUNT_CODE_HASH) {
            ethContractAddress = 0x0000c0De0000C0DE0000c0de0000C0DE0000c0De;
        }

        require(
            _account.codeHash == Lib_EthUtils.getCodeHash(ethContractAddress),
            "Invalid code hash provided."
        );

        require(
            Lib_SecureMerkleTrie.verifyInclusionProof(
                abi.encodePacked(_ovmContractAddress),
                Lib_OVMCodec.encodeEVMAccount(_account),
                _stateTrieWitness,
                preStateRoot
            ),
            "Account state is not correct or invalid inclusion proof provided."
        );

        ovmStateManager.putAccount(
            _ovmContractAddress,
            Lib_OVMCodec.Account({
                nonce: _account.nonce,
                balance: _account.balance,
                storageRoot: _account.storageRoot,
                codeHash: _account.codeHash,
                ethAddress: ethContractAddress,
                isFresh: false
            })
        );
    }

    /**
     * Allows a user to prove that an account does *not* exist in the state.
     * @param _ovmContractAddress Address of the contract on the OVM.
     * @param _stateTrieWitness Proof of the (empty) account state.
     */
    function proveEmptyContractState(
        address _ovmContractAddress,
        bytes memory _stateTrieWitness
    )
        override
        public
        onlyDuringPhase(TransitionPhase.PRE_EXECUTION)
        contributesToFraudProof(preStateRoot, transactionHash)
    {
        // Exit quickly to avoid unnecessary work.
        require(
            ovmStateManager.hasEmptyAccount(_ovmContractAddress) == false,
            "Account state has already been proven."
        );

        require(
            Lib_SecureMerkleTrie.verifyExclusionProof(
                abi.encodePacked(_ovmContractAddress),
                _stateTrieWitness,
                preStateRoot
            ),
            "Account is not empty or invalid inclusion proof provided."
        );

        ovmStateManager.putEmptyAccount(_ovmContractAddress);
    }

    /**
     * Allows a user to prove the initial state of a contract storage slot.
     * @param _ovmContractAddress Address of the contract on the OVM.
     * @param _key Claimed account slot key.
     * @param _value Claimed account slot value.
     * @param _storageTrieWitness Proof of the storage slot.
     */
    function proveStorageSlot(
        address _ovmContractAddress,
        bytes32 _key,
        bytes32 _value,
        bytes memory _storageTrieWitness
    )
        override
        public
        onlyDuringPhase(TransitionPhase.PRE_EXECUTION)
        contributesToFraudProof(preStateRoot, transactionHash)
    {
        // Exit quickly to avoid unnecessary work.
        require(
            ovmStateManager.hasContractStorage(_ovmContractAddress, _key) == false,
            "Storage slot has already been proven."
        );

        require(
            ovmStateManager.hasAccount(_ovmContractAddress) == true,
            "Contract must be verified before proving a storage slot."
        );

        bytes32 storageRoot = ovmStateManager.getAccountStorageRoot(_ovmContractAddress);

        if (storageRoot == EMPTY_ACCOUNT_STORAGE_ROOT) {
            require(
                _value == bytes32(0),
                "OVM_StateTransitioner: Contract storage is empty, but provided value was non-zero."
            );
        } else {
            (
                bool exists,
                bytes memory encodedValue
            ) = Lib_SecureMerkleTrie.get(
                abi.encodePacked(_key),
                _storageTrieWitness,
                storageRoot
            );

            if (exists == true) {
                bytes memory value = Lib_RLPReader.readBytes(encodedValue);
                require(
                    keccak256(abi.encodePacked(Lib_BytesUtils.toBytes32PadLeft(value))) == keccak256(abi.encodePacked(_value)),
                    "OVM_StateTransitioner: Provided value does not match proven value."
                );
            } else {
                require(
                    _value == bytes32(0),
                    "OVM_StateTransitioner: Key was proven to be excluded from the trie, but provided value was non-zero."
                );
            }
        }

        ovmStateManager.putContractStorage(
            _ovmContractAddress,
            _key,
            _value
        );
    }


    /*******************************
     * Public Functions: Execution *
     *******************************/

    /**
     * Executes the state transition.
     * @param _transaction OVM transaction to execute.
     */
    function applyTransaction(
        Lib_OVMCodec.Transaction memory _transaction
    )
        override
        public
        onlyDuringPhase(TransitionPhase.PRE_EXECUTION)
        contributesToFraudProof(preStateRoot, transactionHash)
    {
        require(
            Lib_OVMCodec.hashTransaction(_transaction) == transactionHash,
            "Invalid transaction provided."
        );

        iOVM_ExecutionManager ovmExecutionManager = iOVM_ExecutionManager(resolve("OVM_ExecutionManager"));

        // We call `setExecutionManager` right before `run` (and not earlier) just in case the
        // OVM_ExecutionManager address was updated between the time when this contract was created
        // and when `applyTransaction` was called.
        ovmStateManager.setExecutionManager(address(ovmExecutionManager));

        // `run` always succeeds *unless* the user hasn't provided enough gas to `applyTransaction`
        // or an INVALID_STATE_ACCESS flag was triggered. Either way, we won't get beyond this line
        // if that's the case.
        ovmExecutionManager.run(_transaction, address(ovmStateManager));

        phase = TransitionPhase.POST_EXECUTION;
    }


    /************************************
     * Public Functions: Post-Execution *
     ************************************/

    /**
     * Allows a user to commit the final state of a contract.
     * @param _ovmContractAddress Address of the contract on the OVM.
     * @param _stateTrieWitness Proof of the account state.
     */
    function commitContractState(
        address _ovmContractAddress,
        bytes memory _stateTrieWitness
    )
        override
        public
        onlyDuringPhase(TransitionPhase.POST_EXECUTION)
        contributesToFraudProof(preStateRoot, transactionHash)
    {
        require(
            ovmStateManager.commitAccount(_ovmContractAddress) == true,
            "Account was not changed or has already been committed."
        );

        Lib_OVMCodec.Account memory account = ovmStateManager.getAccount(_ovmContractAddress);

        postStateRoot = Lib_SecureMerkleTrie.update(
            abi.encodePacked(_ovmContractAddress),
            Lib_OVMCodec.encodeEVMAccount(
                Lib_OVMCodec.toEVMAccount(account)
            ),
            _stateTrieWitness,
            postStateRoot
        );
    }

    /**
     * Allows a user to commit the final state of a contract storage slot.
     * @param _ovmContractAddress Address of the contract on the OVM.
     * @param _key Claimed account slot key.
     * @param _stateTrieWitness Proof of the account state.
     * @param _storageTrieWitness Proof of the storage slot.
     */
    function commitStorageSlot(
        address _ovmContractAddress,
        bytes32 _key,
        bytes memory _stateTrieWitness,
        bytes memory _storageTrieWitness
    )
        override
        public
        onlyDuringPhase(TransitionPhase.POST_EXECUTION)
        contributesToFraudProof(preStateRoot, transactionHash)
    {
        require(
            ovmStateManager.commitContractStorage(_ovmContractAddress, _key) == true,
            "Storage slot was not changed or has already been committed."
        );

        Lib_OVMCodec.Account memory account = ovmStateManager.getAccount(_ovmContractAddress);
        bytes32 value = ovmStateManager.getContractStorage(_ovmContractAddress, _key);

        account.storageRoot = Lib_SecureMerkleTrie.update(
            abi.encodePacked(_key),
            Lib_RLPWriter.writeBytes(
                Lib_Bytes32Utils.removeLeadingZeros(value)
            ),
            _storageTrieWitness,
            account.storageRoot
        );

        postStateRoot = Lib_SecureMerkleTrie.update(
            abi.encodePacked(_ovmContractAddress),
            Lib_OVMCodec.encodeEVMAccount(
                Lib_OVMCodec.toEVMAccount(account)
            ),
            _stateTrieWitness,
            postStateRoot
        );

        ovmStateManager.putAccount(_ovmContractAddress, account);
    }


    /**********************************
     * Public Functions: Finalization *
     **********************************/

    /**
     * Finalizes the transition process.
     */
    function completeTransition()
        override
        public
        onlyDuringPhase(TransitionPhase.POST_EXECUTION)
    {
        require(
            ovmStateManager.getTotalUncommittedAccounts() == 0,
            "All accounts must be committed before completing a transition."
        );

        require(
            ovmStateManager.getTotalUncommittedContractStorage() == 0,
            "All storage must be committed before completing a transition."
        );

        phase = TransitionPhase.COMPLETE;
    }
}
