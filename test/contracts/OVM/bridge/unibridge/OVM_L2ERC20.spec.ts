import { expect } from '../../../../setup'

/* External Imports */
import { ethers } from 'hardhat'
import { Signer, Contract } from 'ethers'

/* Internal Imports */
import { NON_ZERO_ADDRESS } from '../../../../helpers'

const ERR_ONLY_BRIDGE = 'May only be called by the bridge'

// Note: withdraw & migrate are tested in OVM_L2TokenBridge.spec.ts
describe('OVM_L2ERC20', () => {
  // init signers
  let bridge: Signer
  let bob: Signer

  before(async () => {
    ;[bridge, bob] = await ethers.getSigners()
  })

  let OVM_L2ERC20: Contract
  beforeEach(async () => {
    // Deploy the contract under test
    OVM_L2ERC20 = await (
      await ethers.getContractFactory('OVM_L2ERC20')
    ).deploy()
  })

  describe('initialize', () => {
    it('onlyBridge: should revert on calls from accounts other than the bridge', async () => {
      await expect(
        OVM_L2ERC20.connect(bob).initialize(NON_ZERO_ADDRESS, 18)
      ).to.be.revertedWith(ERR_ONLY_BRIDGE)
    })

    it('initialize() should set the metadata', async () => {
      // make sure no balance at start of test
      await OVM_L2ERC20.initialize(NON_ZERO_ADDRESS, 18)

      await expect(await OVM_L2ERC20.decimals()).to.be.equal(18)
      await expect(await OVM_L2ERC20.l1Address()).to.be.equal(NON_ZERO_ADDRESS)
    })
  })

  describe('updateInfo', () => {
    it('updateInfo: should revert on calls from accounts other than the bridge', async () => {
      await expect(
        OVM_L2ERC20.connect(bob).updateInfo('Test Name', 'TEST')
      ).to.be.revertedWith(ERR_ONLY_BRIDGE)
    })

    it('updateInfo() should set the token metadata', async () => {
      await OVM_L2ERC20.updateInfo('Test Name', 'TEST')

      await expect(await OVM_L2ERC20.name()).to.be.equal('Test Name')
      await expect(await OVM_L2ERC20.symbol()).to.be.equal('TEST')
    })
  })

  describe('mint', () => {
    it('mint: should revert on calls from accounts other than the bridge', async () => {
      await expect(
        OVM_L2ERC20.connect(bob).mint(NON_ZERO_ADDRESS, 100)
      ).to.be.revertedWith(ERR_ONLY_BRIDGE)
    })

    it('mint: should mint tokens to an address', async () => {
      await expect(await OVM_L2ERC20.balanceOf(NON_ZERO_ADDRESS)).to.be.equal(0)

      await OVM_L2ERC20.mint(NON_ZERO_ADDRESS, 100)

      await expect(await OVM_L2ERC20.balanceOf(NON_ZERO_ADDRESS)).to.be.equal(100)
    })
  })
})
