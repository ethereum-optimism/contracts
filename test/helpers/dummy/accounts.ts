/* External Imports */
import { BigNumber } from 'ethers'

/* Internal Imports */
import { DUMMY_BYTES32 } from './bytes32'
import { ZERO_ADDRESS, NON_ZERO_ADDRESS } from '../constants'
import { makeAddress } from '../utils'
import { OVMAccount } from '../types/ovm-types'

export const DUMMY_ACCOUNTS: Array<{
  address: string
  data: OVMAccount
}> = [
  {
    address: makeAddress('12'),
    data: {
      nonce: BigNumber.from(123),
      balance: BigNumber.from(456),
      storageRoot: DUMMY_BYTES32[0],
      codeHash: DUMMY_BYTES32[1],
      ethAddress: ZERO_ADDRESS,
    },
  },
  {
    address: makeAddress('21'),
    data: {
      nonce: BigNumber.from(321),
      balance: BigNumber.from(654),
      storageRoot: DUMMY_BYTES32[2],
      codeHash: DUMMY_BYTES32[3],
      ethAddress: NON_ZERO_ADDRESS,
    },
  },
]
