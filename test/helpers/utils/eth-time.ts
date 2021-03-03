export const getEthTime = async (provider: any): Promise<number> => {
  return (await provider.getBlock('latest')).timestamp
}

export const setEthTime = async (
  provider: any,
  time: number
): Promise<void> => {
  await provider.send('evm_setNextBlockTimestamp', [time])
}

export const increaseEthTime = async (
  provider: any,
  amount: number
): Promise<void> => {
  await setEthTime(provider, (await getEthTime(provider)) + amount)
  await mineBlock(provider)
}

export const mineBlock = async (
  provider: any,
  timestamp?: number
): Promise<void> => {
  await provider.send('evm_mine', timestamp ? [timestamp] : [])
}

export const getBlockTime = async (
  provider: any,
  block?: number
): Promise<number> => {
  await mineBlock(provider)
  if (!!block) {
    block = await getNextBlockNumber(provider)
  }
  return (await provider.getBlock(block)).timestamp
}

export const getNextBlockNumber = async (provider: any): Promise<number> => {
  return (await provider.getBlock('latest')).number + 1
}
