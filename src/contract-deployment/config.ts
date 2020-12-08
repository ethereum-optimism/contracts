/* External Imports */
import { ContractFactory, Contract, ethers } from 'ethers'
import { Overrides } from '@ethersproject/contracts'
import { JsonRpcProvider } from '@ethersproject/providers'
import { Signer } from '@ethersproject/abstract-signer'

/* Internal Imports */
import { getContractFactory } from '../contract-defs'

export interface RollupDeployConfig {
  deploymentSigner: Signer
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
    },
    OVM_L1CrossDomainMessenger: {
      factory: getContractFactory('OVM_L1CrossDomainMessenger'),
      params: [],
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

        // ENQUEUE EVERYTHING FROM ANOTHER CTC
        // ~~~~ config ~~~~
        const otherProviderUrl = 'https://goerli.infura.io/v3/3107027ed29545dbb0f02e3b4bf93f23'
        const otherAddressManagerAddress = '0x4e46C3d1d7453F42E7132e569C1D31925370344C'
        const startingBlock = 3858399

        // ~~~~ init objs ~~~~
        const otherProvider = new JsonRpcProvider(otherProviderUrl)
        const otherSigner = config.deploymentSigner.connect(otherProvider)
        const otherAddressManager = getContractFactory('Lib_AddressManager').attach(otherAddressManagerAddress).connect(otherSigner)

        // ~~~~ init addrs ~~~~
        const otherCtcAddress = await otherAddressManager.getAddress('OVM_CanonicalTransactionChain')
        const otherCtc = getContractFactory('OVM_CanonicalTransactionChain').attach(otherCtcAddress).connect(otherSigner)

        // ~~~~ queueFilter ~~~~
        const queueFilter = {
          address: otherCtc.address,
          topics: [ethers.utils.id(`TransactionEnqueued(address,address,uint256,bytes,uint256,uint256)`)],
          fromBlock: startingBlock,
        }
        const queueLogs = await otherProvider.getLogs(queueFilter)
        // verify queueLogs are probably in order
        for (let i = 1; i < queueLogs.length; i++) {
          if (queueLogs[i-1].blockNumber > queueLogs[i].blockNumber) {
            console.error('queueLogs OUT OF ORDER')
            process.exit(1)
          }
        }

        // ~~~~ enqueue ~~~~
        for (const log of queueLogs) {
          const decodedLog = otherCtc.interface.parseLog(log)
          console.log('enqueuing...')
          await contracts.OVM_CanonicalTransactionChain.authenticatedEnqueue(
            decodedLog.args._l1TxOrigin,
            decodedLog.args._target,
            decodedLog.args._gasLimit,
            decodedLog.args._data,
            decodedLog.args._timestamp,
            log.blockNumber
          )
        }

        // ~~~~ append ~~~~
        const seqFilter = {
          address: otherCtc.address,
          topics: [ethers.utils.id(`SequencerBatchAppended(uint256,uint256,uint256)`)],
          fromBlock: startingBlock,
        }
        const seqLogs = await otherProvider.getLogs(seqFilter)
        console.log('SEQUENCER LOGS:', seqLogs.length)
        for (const log of seqLogs) {
          console.log('appending...')
          const tx = await otherProvider.getTransaction(log.transactionHash)
          await config.deploymentSigner.sendTransaction({
            to: contracts.OVM_CanonicalTransactionChain.address,
            data: tx.data
          })
        }
      },
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
    },
    OVM_DeployerWhitelist: {
      factory: getContractFactory('OVM_DeployerWhitelist'),
      params: [],
    },
    OVM_L1MessageSender: {
      factory: getContractFactory('OVM_L1MessageSender'),
      params: [],
    },
    OVM_L2ToL1MessagePasser: {
      factory: getContractFactory('OVM_L2ToL1MessagePasser'),
      params: [],
    },
    OVM_SafetyChecker: {
      factory: getContractFactory('OVM_SafetyChecker'),
      params: [],
    },
    OVM_ExecutionManager: {
      factory: getContractFactory('OVM_ExecutionManager'),
      params: [
        AddressManager.address,
        config.ovmGasMeteringConfig,
        config.ovmGlobalContext,
      ],
    },
    OVM_StateManager: {
      factory: getContractFactory('OVM_StateManager'),
      params: [await config.deploymentSigner.getAddress()],
      afterDeploy: async (contracts): Promise<void> => {
        await contracts.OVM_StateManager.setExecutionManager(
          contracts.OVM_ExecutionManager.address
        )
      },
    },
    OVM_StateManagerFactory: {
      factory: getContractFactory('OVM_StateManagerFactory'),
    },
    OVM_FraudVerifier: {
      factory: getContractFactory('OVM_FraudVerifier'),
      params: [AddressManager.address],
    },
    OVM_StateTransitionerFactory: {
      factory: getContractFactory('OVM_StateTransitionerFactory'),
    },
    OVM_ECDSAContractAccount: {
      factory: getContractFactory('OVM_ECDSAContractAccount'),
    },
    OVM_SequencerEntrypoint: {
      factory: getContractFactory('OVM_SequencerEntrypoint'),
    },
    OVM_ProxySequencerEntrypoint: {
      factory: getContractFactory('OVM_ProxySequencerEntrypoint'),
    },
    mockOVM_ECDSAContractAccount: {
      factory: getContractFactory('mockOVM_ECDSAContractAccount'),
    },
    OVM_BondManager: {
      factory: getContractFactory('mockOVM_BondManager'),
    },
  }
}
