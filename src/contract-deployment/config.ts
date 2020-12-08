/* External Imports */
import { Signer, ContractFactory, Contract } from 'ethers'
import { Overrides } from '@ethersproject/contracts'

/* Internal Imports */
import { getContractFactory } from '../contract-defs'
import { DeploymentTarget, DeployTarget } from './helpers'

export interface RollupDeployConfig {
  deploymentSigner: Signer
  deploymentTarget: DeploymentTarget,
  ovmGasMeteringConfig: {
    minTransactionGasLimit: number
    maxTransactionGasLimit: number
    maxGasPerQueuePerEpoch: number
    secondsPerEpoch: number
  }
  ovmGlobalContext: {
    ovmCHAINID: number
    L2CrossDomainMessengerAddress: string
  }
  transactionChainConfig: {
    sequencer: string | Signer
    forceInclusionPeriodSeconds: number
  }
  stateChainConfig: {
    fraudProofWindowSeconds: number
    sequencerPublishWindowSeconds: number
  }
  whitelistConfig: {
    owner: string | Signer
    allowArbitraryContractDeployment: boolean
  }
  deployOverrides?: Overrides
  dependencies?: string[]
}

export interface ContractDeployParameters {
  factory: ContractFactory
  deploymentTarget: DeploymentTarget,
  params?: any[]
  afterDeploy?: (contracts?: { [name: string]: Contract }) => Promise<void>
}

export interface ContractDeployConfig {
  [name: string]: ContractDeployParameters
}

export const makeContractDeployConfig = async (
  config: RollupDeployConfig,
  AddressManager: Contract
): Promise<ContractDeployConfig> => {
  return {
    OVM_L2CrossDomainMessenger: {
      factory: getContractFactory('OVM_L2CrossDomainMessenger'),
      params: [AddressManager.address],
      deploymentTarget: DeployTarget.L2,
    },
    OVM_L1CrossDomainMessenger: {
      factory: getContractFactory('OVM_L1CrossDomainMessenger'),
      params: [],
      deploymentTarget: DeployTarget.L1,
    },
    Proxy__OVM_L1CrossDomainMessenger: {
      factory: getContractFactory('Lib_ResolvedDelegateProxy'),
      params: [AddressManager.address, 'OVM_L1CrossDomainMessenger'],
      afterDeploy: async (contracts): Promise<void> => {
        const xDomainMessenger = getContractFactory(
          'OVM_L1CrossDomainMessenger'
        )
          .connect(config.deploymentSigner)
          .attach(contracts.Proxy__OVM_L1CrossDomainMessenger.address)
        await xDomainMessenger.initialize(AddressManager.address)
        await AddressManager.setAddress(
          'OVM_L2CrossDomainMessenger',
          config.ovmGlobalContext.L2CrossDomainMessengerAddress
        )
      },
      deploymentTarget: DeployTarget.L1,
    },
    OVM_CanonicalTransactionChain: {
      factory: getContractFactory('OVM_CanonicalTransactionChain'),
      params: [
        AddressManager.address,
        config.transactionChainConfig.forceInclusionPeriodSeconds,
      ],
      afterDeploy: async (contracts): Promise<void> => {
        const sequencer = config.transactionChainConfig.sequencer
        const sequencerAddress =
          typeof sequencer === 'string'
            ? sequencer
            : await sequencer.getAddress()
        await AddressManager.setAddress('OVM_Sequencer', sequencerAddress)
        await AddressManager.setAddress('Sequencer', sequencerAddress)
        await contracts.OVM_CanonicalTransactionChain.init()
      },
      deploymentTarget: DeployTarget.L1L2,
    },
    OVM_StateCommitmentChain: {
      factory: getContractFactory('OVM_StateCommitmentChain'),
      params: [
        AddressManager.address,
        config.stateChainConfig.fraudProofWindowSeconds,
        config.stateChainConfig.sequencerPublishWindowSeconds,
      ],
      afterDeploy: async (contracts): Promise<void> => {
        await contracts.OVM_StateCommitmentChain.init()
      },
      deploymentTarget: DeployTarget.L1L2,
    },
    OVM_DeployerWhitelist: {
      factory: getContractFactory('OVM_DeployerWhitelist'),
      params: [],
      deploymentTarget: DeployTarget.L2,
    },
    OVM_L1MessageSender: {
      factory: getContractFactory('OVM_L1MessageSender'),
      params: [],
      deploymentTarget: DeployTarget.L2,
    },
    OVM_L2ToL1MessagePasser: {
      factory: getContractFactory('OVM_L2ToL1MessagePasser'),
      params: [],
      deploymentTarget: DeployTarget.L2,
    },
    OVM_SafetyChecker: {
      factory: getContractFactory('OVM_SafetyChecker'),
      params: [],
      deploymentTarget: DeployTarget.L1L2,
    },
    OVM_ExecutionManager: {
      factory: getContractFactory('OVM_ExecutionManager'),
      params: [
        AddressManager.address,
        config.ovmGasMeteringConfig,
        config.ovmGlobalContext,
      ],
      deploymentTarget: DeployTarget.L1L2,
    },
    OVM_StateManager: {
      factory: getContractFactory('OVM_StateManager'),
      params: [await config.deploymentSigner.getAddress()],
      afterDeploy: async (contracts): Promise<void> => {
        await contracts.OVM_StateManager.setExecutionManager(
          contracts.OVM_ExecutionManager.address
        )
      },
      deploymentTarget: DeployTarget.L1L2,
    },
    OVM_StateManagerFactory: {
      factory: getContractFactory('OVM_StateManagerFactory'),
      deploymentTarget: DeployTarget.L1L2,
    },
    OVM_FraudVerifier: {
      factory: getContractFactory('OVM_FraudVerifier'),
      params: [AddressManager.address],
      deploymentTarget: DeployTarget.L1L2,
    },
    OVM_StateTransitionerFactory: {
      factory: getContractFactory('OVM_StateTransitionerFactory'),
      deploymentTarget: DeployTarget.L1L2,
    },
    OVM_ECDSAContractAccount: {
      factory: getContractFactory('OVM_ECDSAContractAccount'),
      deploymentTarget: DeployTarget.L2,
    },
    OVM_SequencerEntrypoint: {
      factory: getContractFactory('OVM_SequencerEntrypoint'),
      deploymentTarget: DeployTarget.L1L2,
    },
    OVM_ProxySequencerEntrypoint: {
      factory: getContractFactory('OVM_ProxySequencerEntrypoint'),
      deploymentTarget: DeployTarget.L2,
    },
    mockOVM_ECDSAContractAccount: {
      factory: getContractFactory('mockOVM_ECDSAContractAccount'),
      deploymentTarget: DeployTarget.L2,
    },
    OVM_BondManager: {
      factory: getContractFactory('mockOVM_BondManager'),
      deploymentTarget: DeployTarget.L1L2,
    },
  }
}
