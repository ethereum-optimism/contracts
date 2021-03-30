/* External Imports */
import { ethers } from 'ethers'
// import { merge } from 'lodash'

/* Internal Imports */
import {
  ExecutionManagerTestRunner,
  TestDefinition,
  OVM_TX_GAS_LIMIT,
  NON_NULL_BYTES32,
  getStorageXOR,
  REVERT_FLAGS,
} from '../../../../helpers'

const UPGRADER_ADDRESS = '0x4200000000000000000000000000000000000009'
const UPGRADED_ADDRESS = '0x1234123412341234123412341234123412341234'

const sharedPreState = {
  ExecutionManager: {
    ovmStateManager: '$OVM_STATE_MANAGER',
    ovmSafetyChecker: '$OVM_SAFETY_CHECKER',
    messageRecord: {
      nuisanceGasLeft: OVM_TX_GAS_LIMIT,
    },
  },
  StateManager: {
    owner: '$OVM_EXECUTION_MANAGER',
    accounts: {
      $DUMMY_OVM_ADDRESS_1: {
        codeHash: NON_NULL_BYTES32,
        ethAddress: '$OVM_CALL_HELPER',
      },
      [UPGRADER_ADDRESS]: {
        codeHash: NON_NULL_BYTES32,
        ethAddress: '$OVM_CALL_HELPER',
      },
    },
    contractStorage: {
      [UPGRADED_ADDRESS]: {
        [NON_NULL_BYTES32]: getStorageXOR(ethers.constants.HashZero),
      },
    },
  },
}

const verifiedUpgradePreState = {
  StateManager: {
    accounts: {
      [UPGRADED_ADDRESS]: {
        codeHash: NON_NULL_BYTES32,
        ethAddress: '$OVM_CALL_HELPER',
      },
    },
    verifiedContractStorage: {
      [UPGRADED_ADDRESS]: {
        [NON_NULL_BYTES32]: true,
      },
    },
  },
}

const test_ovmSETSTORAGEFunctionality: TestDefinition = {
  name: 'Functionality tests for ovmSETSTORAGE',
  preState: sharedPreState,
  subTests: [
    {
      name: 'ovmSETSTORAGE -- success case',
      focus: true,
      preState: verifiedUpgradePreState,
      postState: {
        StateManager: {
          contractStorage: {
            [UPGRADED_ADDRESS]: {
              [NON_NULL_BYTES32]: getStorageXOR(NON_NULL_BYTES32),
            },
          },
        },
      },
      parameters: [
        {
          focus: true,
          name: 'success case',
          steps: [
            {
              functionName: 'ovmCALL',
              functionParams: {
                gasLimit: OVM_TX_GAS_LIMIT,
                target: UPGRADER_ADDRESS,
                subSteps: [
                  {
                    functionName: 'ovmSETSTORAGE',
                    functionParams: {
                      address: UPGRADED_ADDRESS,
                      key: NON_NULL_BYTES32,
                      value: NON_NULL_BYTES32
                    },
                    expectedReturnStatus: true,
                  },
                ],
              },
              expectedReturnStatus: true,
            },
          ],
        },
      ],
    },
    {
      name: 'ovmSETSTORAGE -- unauthorized case',
      focus: true,
      preState: verifiedUpgradePreState,
      parameters: [
        {
          focus: true,
          name: 'unauthorized case',
          steps: [
            {
              functionName: 'ovmCALL',
              functionParams: {
                gasLimit: OVM_TX_GAS_LIMIT,
                target: '$DUMMY_OVM_ADDRESS_1',
                subSteps: [
                  {
                    functionName: 'ovmSETSTORAGE',
                    functionParams: {
                      address: UPGRADED_ADDRESS,
                      key: NON_NULL_BYTES32,
                      value: NON_NULL_BYTES32
                    },
                    expectedReturnStatus: false,
                    expectedReturnValue: {
                      flag: REVERT_FLAGS.CALLER_NOT_ALLOWED,
                      onlyValidateFlag: true
                    },
                  },
                ],
              },
              expectedReturnStatus: false,
            },
          ],
        }
      ],
    },
  ],
}

const test_ovmSETSTORAGEAccess: TestDefinition = {
  name: 'State access compliance tests for ovmSETSTORAGE',
  preState: sharedPreState,
  subTests: [
    {
      name: 'ovmSETSTORAGE (UNVERIFIED_ACCOUNT)',
      focus: true,
      parameters: [
        {
          focus: true,
          name: 'ovmSETSTORAGE with a missing account',
          expectInvalidStateAccess: true,
          steps: [
            {
              functionName: 'ovmCALL',
              functionParams: {
                gasLimit: OVM_TX_GAS_LIMIT,
                target: UPGRADER_ADDRESS,
                subSteps: [
                  {
                    functionName: 'ovmSETSTORAGE',
                    functionParams: {
                      address: UPGRADED_ADDRESS,
                      key: NON_NULL_BYTES32,
                      value: NON_NULL_BYTES32
                    },
                    expectedReturnStatus: false,
                    expectedReturnValue: {
                      flag: REVERT_FLAGS.INVALID_STATE_ACCESS,
                      onlyValidateFlag: true
                    },
                  },
                ],
              },
              expectedReturnStatus: false,
              expectedReturnValue: {
                flag: REVERT_FLAGS.INVALID_STATE_ACCESS,
                onlyValidateFlag: true
              },
            },
          ],
        },
      ],
    },
    {
      name: 'ovmSETSTORAGE (UNVERIFIED_SLOT)',
      focus: true,
      preState: {
        StateManager: {
          accounts: {
            [UPGRADED_ADDRESS]: {
              codeHash: NON_NULL_BYTES32,
              ethAddress: '$OVM_CALL_HELPER',
            },
          },
        },
      },
      parameters: [
        {
          focus: true,
          name: 'ovmSETSTORAGE with a missing storage slot',
          expectInvalidStateAccess: true,
          steps: [
            {
              functionName: 'ovmCALL',
              functionParams: {
                gasLimit: OVM_TX_GAS_LIMIT,
                target: UPGRADER_ADDRESS,
                subSteps: [
                  {
                    functionName: 'ovmSETSTORAGE',
                    functionParams: {
                      address: UPGRADED_ADDRESS,
                      key: NON_NULL_BYTES32,
                      value: NON_NULL_BYTES32
                    },
                    expectedReturnStatus: false,
                    expectedReturnValue: {
                      flag: REVERT_FLAGS.INVALID_STATE_ACCESS,
                      onlyValidateFlag: true
                    },
                  },
                ],
              },
              expectedReturnStatus: false,
              expectedReturnValue: {
                flag: REVERT_FLAGS.INVALID_STATE_ACCESS,
                onlyValidateFlag: true
              },
            },
          ],
        },
      ],
    },
  ],
}
const runner = new ExecutionManagerTestRunner()
runner.run(test_ovmSETSTORAGEFunctionality)
runner.run(test_ovmSETSTORAGEAccess)
