/* tslint:disable:no-empty */
import '../../../setup'

/* Internal Imports */
import { Lib_OVMCodec_TEST_JSON } from '../../../data'
import { runJsonTest } from '../../../helpers'

describe.skip('Lib_OVMCodec', () => {
  describe('JSON tests', () => {
    runJsonTest('TestLib_OVMCodec', Lib_OVMCodec_TEST_JSON)
  })
})
