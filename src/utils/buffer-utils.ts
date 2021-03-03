/* External Imports */
import { BigNumber } from 'ethers'
import { toHexString, fromHexString } from '@eth-optimism/core-utils'

export const toHexString32 = (
  input: Buffer | string | number,
  padRight = false
): string => {
  if (typeof input === 'number') {
    input = BigNumber.from(input).toHexString()
  }

  input = toHexString(input).slice(2)
  return '0x' + (padRight ? input.padEnd(64, '0') : input.padStart(64, '0'))
}

export const getHexSlice = (
  input: Buffer | string,
  start: number,
  length: number
): string => {
  return toHexString(fromHexString(input).slice(start, start + length))
}
