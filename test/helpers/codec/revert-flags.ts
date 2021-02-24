/* External Imports */
import { ethers } from 'hardhat'

export const encodeRevertData = (
  flag: number,
  data: string = '0x',
  nuisanceGasLeft: number = 0,
  ovmGasRefund: number = 0
): string => {
  const abiEncoded: string = ethers.utils.defaultAbiCoder.encode(
    ['uint256', 'uint256', 'uint256', 'bytes'],
    [flag, nuisanceGasLeft, ovmGasRefund, data]
  )
  return abiEncoded
}

export const decodeRevertData = (revertData: string): any => {
  const decoded = ethers.utils.defaultAbiCoder.decode(
    ['uint256', 'uint256', 'uint256', 'bytes'],
    revertData
  )

  return (
    '[revertFlag:' +
    Object.keys(REVERT_FLAGS)[decoded[0]] +
    ', nuisanceGasLeft:' +
    decoded[1] +
    ', ovmGasRefund: ' +
    decoded[2] +
    ', data: ' +
    decoded[3] +
    ']'
  )
}

export const REVERT_FLAGS = {
  UNUSED: 0,
  DID_NOT_REVERT: 1,
  OUT_OF_GAS: 2,
  INTENTIONAL_REVERT: 3,
  EXCEEDS_NUISANCE_GAS: 4,
  INVALID_STATE_ACCESS: 5,
  UNSAFE_BYTECODE: 6,
  CREATE_COLLISION: 7,
  STATIC_VIOLATION: 8,
  CREATE_EXCEPTION: 9,
  CREATOR_NOT_ALLOWED: 10,
}
