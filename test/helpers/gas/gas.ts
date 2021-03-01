export const a = null
// export const measure = (
//   methodName: string,
//   methodArgs: Array<any> = [],
//   doFirst: () => Promise<any> = async () => {
//     return
//   }
// ) => {
//   it('measured consumption!', async () => {
//     await doFirst()
//     await getSMGasCost(methodName, methodArgs)
//   })
// }

// export const getSMGasCost = async (
//   methodName: string,
//   methodArgs: Array<any> = []
// ): Promise<number> => {
//   const gasCost: number = await Helper_GasMeasurer.callStatic.measureCallGas(
//     OVM_ExecutionManager.address,
//     OVM_ExecutionManager.interface.encodeFunctionData(methodName, methodArgs)
//   )
//   console.log(`          calculated gas cost of ${gasCost}`)

//   return gasCost
// }