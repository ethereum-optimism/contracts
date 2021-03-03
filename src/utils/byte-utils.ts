import { add0x } from '@eth-optimism/core-utils'

const hexRegex = /^(0x)?[0-9a-fA-F]*$/

/**
 * Generates a hex string of repeated bytes.
 * @param byte Byte to repeat.
 * @param len Number of times to repeat the byte.
 * @return '0x'-prefixed hex string filled with the provided byte.
 */
export const makeHexString = (byte: string, len: number): string => {
  return '0x' + byte.repeat(len)
}

/**
 * Genereates an address with a repeated byte.
 * @param byte Byte to repeat in the address.
 * @return Address filled with the repeated byte.
 */
export const makeAddress = (byte: string): string => {
  return makeHexString(byte, 20)
}

/**
 * Returns whether or not the provided string is a hex string.
 *
 * @param str The string to test.
 * @returns True if the provided string is a hex string, false otherwise.
 */
export const isHexString = (str: string): boolean => {
  return hexRegex.test(str)
}
/**
 * Converts a JavaScript number to a big-endian hex string.
 * @param number the JavaScript number to be converted.
 * @param padToBytes the number of numeric bytes the resulting string should be, -1 if no padding should be done.
 * @returns the JavaScript number as a string.
 */
export const numberToHexString = (
  number: number,
  padToBytes: number = -1
): string => {
  let str = number.toString(16)
  if (padToBytes > 0 || str.length < padToBytes * 2) {
    str = `${'0'.repeat(padToBytes * 2 - str.length)}${str}`
  }
  return add0x(str)
}
