/* External Imports */
import { Contract } from 'ethers'
import { Interface, AbiCoder } from 'ethers/lib/utils'
import * as path from 'path'

/* Internal Imports */
import { TestStep } from './test.types'

const abi = new AbiCoder()

const getContractDefinition = (name: string): any => {
  return require(path.join(__dirname, '../../../artifacts', `${name}.json`))
}

export const getInitcode = (name: string): string => {
  return getContractDefinition(name).bytecode
}

export interface TestCallGenerator {
  getCalldata(): string
  getReturnData(): string // get expected
}

export class DefaultTestGenerator implements TestCallGenerator {
  constructor(
    protected ovmExecutionManager: Contract,
    protected ovmCallHelper: Contract,
    protected ovmCreateStorer: Contract,
    protected ovmCreateHelper: Interface,
    protected step: TestStep
  ) {}

  getFunctionParams(): any[] {
      return this.step.functionParams
  }

  getReturnValues(): any[] {
      return this.step.returnValues
  }

  getCalldata(): string {
      return this.ovmExecutionManager.interface.encodeFunctionData(
          this.step.functionName,
          this.getFunctionParams()
      )
  }

  getReturnData(): string {
      return this.ovmExecutionManager.interface.encodeFunctionResult(
          this.step.functionName,
          this.getReturnValues()
      )
  }
}

export class ovmCALLGenerator extends DefaultTestGenerator {
  getCalleeGenerators(): TestCallGenerator[] {
      return (this.step.functionParams[2] as TestStep[]).map((step) => {
          return getTestGenerator(
              step,
              this.ovmExecutionManager,
              this.ovmCallHelper,
              this.ovmCreateStorer,
              this.ovmCreateHelper
          )
      })
  }

  getFunctionParams(): any[] {
    return [
      this.step.functionParams[0],
      this.step.functionParams[1],
      this.ovmCallHelper.interface.encodeFunctionData(
        'runSteps',
        [
          this.getCalleeGenerators().map((calleeGenerator) => {
            return calleeGenerator.getCalldata()
          }),
          !this.step.returnStatus,
          this.ovmCreateStorer.address
        ]
      )
    ]
  }

  getReturnValues(): any[] {
    return [
      this.step.returnStatus,
      this.ovmCallHelper.interface.encodeFunctionResult(
      'runSteps',
        [
          this.getCalleeGenerators().map((calleeGenerator) => {
            return {
              success: true,
              data: calleeGenerator.getReturnData()
            }
          })
        ]
      )
    ]
  }
}

export class ovmCREATEGenerator extends DefaultTestGenerator {
  getInitcodeGenerators(): TestCallGenerator[] {
      return (this.step.functionParams[1] as TestStep[]).map((step) => {
          return getTestGenerator(
              step,
              this.ovmExecutionManager,
              this.ovmCallHelper,
              this.ovmCreateStorer,
              this.ovmCreateHelper
          )
      })
  }

  getFunctionParams(): any[] {
    return [
      getInitcode('Helper_CodeContractForCreates') +
      this.ovmCreateHelper.encodeDeploy([
        this.getInitcodeGenerators().map((initcodeGenerator) => {
          return initcodeGenerator.getCalldata()
        }),
        !this.step.returnStatus,
        this.step.functionParams[0],
        this.ovmCreateStorer.address
      ]).slice(2)
    ]
  }

  getReturnData(): string {
    return abi.encode(
      ['bytes', 'bytes'],
      [
        this.ovmExecutionManager.interface.encodeFunctionResult(
          this.step.functionName,
          this.getReturnValues()
        ),
        this.ovmCreateStorer.interface.encodeFunctionResult(
          'getLastResponses',
          [
            this.getInitcodeGenerators().map((initcodeGenerator) => {
              return {
                success: true, // TODO: figure out if we need this and expose in generator interface if so.
                data: initcodeGenerator.getReturnData()
              }
            })
          ]
        )
      ]
    )
  }
}

export const getTestGenerator = (
  step: TestStep,
  ovmExecutionManager: Contract,
  ovmCallHelper: Contract,
  ovmCreateStorer: Contract,
  ovmCreateHelper: Interface
): TestCallGenerator => {
  switch (step.functionName) {
    case 'ovmCALL':
      return new ovmCALLGenerator(
        ovmExecutionManager,
        ovmCallHelper,
        ovmCreateStorer,
        ovmCreateHelper,
        step
      )
    case 'ovmCREATE':
      return new ovmCREATEGenerator(
        ovmExecutionManager,
        ovmCallHelper,
        ovmCreateStorer,
        ovmCreateHelper,
        step
      )
    default:
      return new DefaultTestGenerator(
        ovmExecutionManager,
        ovmCallHelper,
        ovmCreateStorer,
        ovmCreateHelper,
        step
      )
    }
}
