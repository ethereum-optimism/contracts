import { waffle, ethers as deployer } from '@nomiclabs/buidler'
import { smoddit, smockit, MockContract } from '@eth-optimism/smock'
import { expect } from 'chai'
import { ethers, Contract, BigNumber } from 'ethers'

describe('BondManager', () => {
  const provider = waffle.provider
  let wallets = provider.getWallets()

  let bondManager: Contract
  let token: Contract
  let manager: Contract

  const canonicalStateCommitmentChain = wallets[1]
  const stateTransitioner = wallets[3]
  const witnessProvider = wallets[4]
  const witnessProvider2 = wallets[5]

  const sender = wallets[0].address

  const preStateRoot =
    '0x1111111111111111111111111111111111111111111111111111111111111111'
  const amount = ethers.utils.parseEther('1')

  beforeEach(async () => {
    // deploy the address manager
    manager = await (
      await deployer.getContractFactory('Lib_AddressManager')
    ).deploy()

    // deploy the state manager and mock it for the state transitioner
    const stateManagerFactory = smockit(
      await (
        await deployer.getContractFactory('OVM_StateManagerFactory')
      ).deploy()
    )
    stateManagerFactory.smocked.create.will.return.with(
      ethers.constants.AddressZero
    )
    await manager.setAddress(
      'OVM_StateManagerFactory',
      stateManagerFactory.address
    )

    // deploy the fraud verifier and mock its pre-state root transitioner
    const fraudVerifier = await (await smoddit('OVM_FraudVerifier')).deploy(
      manager.address
    )
    expect(await fraudVerifier.getStateTransitioner(preStateRoot)).to.eq(
      ethers.constants.AddressZero
    )
    fraudVerifier.smodify.put({
      transitioners: {
        [preStateRoot]: stateTransitioner.address,
      },
    })
    expect(await fraudVerifier.getStateTransitioner(preStateRoot)).to.eq(
      stateTransitioner.address
    )
    await manager.setAddress('OVM_FraudVerifier', fraudVerifier.address)

    // Fake state commitment chain for the `stake` call
    await manager.setAddress(
      'OVM_CanonicalStateCommitmentChain',
      canonicalStateCommitmentChain.address
    )

    // deploy a test erc20 token to be used for the bonds
    token = await (await deployer.getContractFactory('TestERC20')).deploy()
    await token.mint(sender, ethers.utils.parseEther('100'))

    bondManager = await (await smoddit('OVM_BondManager')).deploy(
      token.address,
      manager.address
    )
  })

  describe('collateral management', () => {
    let balanceBefore: BigNumber

    beforeEach(async () => {
      await token.approve(bondManager.address, ethers.constants.MaxUint256)
      balanceBefore = await token.balanceOf(sender)
      await bondManager.deposit(amount)
    })

    it('can deposit', async () => {
      const balanceAfter = await token.balanceOf(sender)
      expect(balanceAfter).to.be.eq(balanceBefore.sub(amount))
      expect(await bondManager.bonds(sender)).to.eq(amount)
    })

    it('can withdraw', async () => {
      await bondManager.withdraw(amount)
      expect(await bondManager.bonds(sender)).to.eq(0)
    })

    it('cannot withdraw more than deposited', async () => {
      await expect(bondManager.withdraw(amount.add(1))).to.be.reverted
    })

    it('can stake', async () => {
      const batchIdx = 1
      await bondManager
        .connect(canonicalStateCommitmentChain)
        .stake(sender, batchIdx)
      expect(await bondManager.bonds(sender)).to.eq(0)
      expect(await bondManager.sequencers(batchIdx)).to.eq(sender)
    })

    it('cannot withdraw after staking', async () => {
      await bondManager.connect(canonicalStateCommitmentChain).stake(sender, 0)
      await expect(bondManager.withdraw(1)).to.be.reverted
    })

    it('can deposit twice and withdraw after staking', async () => {
      await bondManager.deposit(amount)
      await bondManager.connect(canonicalStateCommitmentChain).stake(sender, 0)
      await bondManager.withdraw(ethers.utils.parseEther('0.5'))

      // has the correct amount of collateral remaining
      expect(await bondManager.bonds(sender)).to.eq(
        ethers.utils.parseEther('0.5')
      )

      // ...which is not enough for further staking
      await expect(
        bondManager.connect(canonicalStateCommitmentChain).stake(sender, 1)
      ).to.be.reverted
    })

    it('bumps required collateral', async () => {
      // sets collateral to 2 eth, which is more than what we have deposited
      await bondManager.setRequiredCollatreal(ethers.utils.parseEther('2'))
      await expect(
        bondManager.connect(canonicalStateCommitmentChain).stake(sender, 1)
      ).to.be.reverted
    })

    it('cannot lower collateral reqs', async () => {
      await expect(
        bondManager.setRequiredCollatreal(ethers.utils.parseEther('0.99'))
      ).to.be.revertedWith(
        'BondManager: New collateral value must be greater than the previous one'
      )
    })

    it('only owner can adjust collateral', async () => {
      await expect(
        bondManager.connect(wallets[2]).setRequiredCollatreal(amount.add(1))
      ).to.be.revertedWith(
        "BondManager: Only the contract's owner can call this function"
      )
    })
  })

  describe('dispute resolution', () => {
    beforeEach(async () => {
      await bondManager
        .connect(stateTransitioner)
        .storeWitnessProvider(preStateRoot, witnessProvider.address)
      await bondManager
        .connect(stateTransitioner)
        .storeWitnessProvider(preStateRoot, witnessProvider.address)
      await bondManager
        .connect(stateTransitioner)
        .storeWitnessProvider(preStateRoot, witnessProvider2.address)
    })

    describe('post witnesses', () => {
      it('can post witnesses from the transitioner for a state root', async () => {
        const reward = await bondManager.witnessProviders(preStateRoot)
        expect(reward.canClaim).to.be.false
        expect(reward.total).to.be.equal(3)
        expect(
          await bondManager.getNumberOfClaims(
            preStateRoot,
            witnessProvider.address
          )
        ).to.be.equal(2)
        expect(
          await bondManager.getNumberOfClaims(
            preStateRoot,
            witnessProvider2.address
          )
        ).to.be.equal(1)
      })

      it('cannot post witnesses from non-transitioners for that state root', async () => {
        await expect(
          bondManager.storeWitnessProvider(
            preStateRoot,
            witnessProvider.address
          )
        ).to.be.reverted
      })
    })

    it('cannot claim before canClaim is set', async () => {
      await expect(bondManager.payout(preStateRoot)).to.be.revertedWith(
        'Cannot claim rewards'
      )
    })

    describe('claims', () => {
      beforeEach(async () => {
        // deposit the collateral to be distributed
        await token.approve(bondManager.address, ethers.constants.MaxUint256)
        await bondManager.deposit(amount)

        // smodify the canClaim value to true to test claiming
        bondManager.smodify.set({
          witnessProviders: {
            [preStateRoot]: {
              canClaim: true,
            },
          },
        })
        const reward = await bondManager.witnessProviders(preStateRoot)
        expect(reward.canClaim).to.be.true
      })

      it('rewards get paid out proportionally', async () => {
        // One will get 2/3rds of the bond, the other will get 1/3rd
        const balanceBefore1 = await token.balanceOf(witnessProvider.address)
        const balanceBefore2 = await token.balanceOf(witnessProvider2.address)

        await bondManager.connect(witnessProvider).payout(preStateRoot)
        await bondManager.connect(witnessProvider2).payout(preStateRoot)

        const balanceAfter1 = await token.balanceOf(witnessProvider.address)
        const balanceAfter2 = await token.balanceOf(witnessProvider2.address)

        expect(balanceAfter1).to.be.eq(balanceBefore1.add(amount.mul(2).div(3)))
        expect(balanceAfter2).to.be.eq(balanceBefore2.add(amount.div(3)))
      })

      it('cannot double claim', async () => {
        const balance1 = await token.balanceOf(witnessProvider.address)
        await bondManager.connect(witnessProvider).payout(preStateRoot)
        const balance2 = await token.balanceOf(witnessProvider.address)
        expect(balance2).to.be.eq(balance1.add(amount.mul(2).div(3)))

        // re-claiming does not give the user any extra funds
        // TODO: Should we revert instead and require that the user has >0 claim
        // votes?
        await bondManager.connect(witnessProvider).payout(preStateRoot)
        const balance3 = await token.balanceOf(witnessProvider.address)
        expect(balance3).to.be.eq(balance2)
      })
    })

    describe('finalize', () => {
      const batchIdx = 1

      beforeEach(async () => {
        // stake so that sequencers map is not empty
        await token.approve(bondManager.address, ethers.constants.MaxUint256)
        await bondManager.deposit(amount)
        await bondManager
          .connect(canonicalStateCommitmentChain)
          .stake(sender, batchIdx)
      })

      it('only fraud verifier can finalize', async () => {
        await expect(bondManager.finalize(preStateRoot, batchIdx, false)).to.be
          .reverted
      })

      it('isFraud = true sets canClaim', async () => {
        // override the fraud verifier
        await manager.setAddress('OVM_FraudVerifier', sender)
        await bondManager.finalize(preStateRoot, batchIdx, true)

        expect((await bondManager.witnessProviders(preStateRoot)).canClaim).to
          .be.true
        expect(
          await bondManager.sequencers(batchIdx),
          ethers.constants.AddressZero
        )

        // cannot double finalize
        await expect(
          bondManager.finalize(preStateRoot, batchIdx, true)
        ).to.be.revertedWith('err: sequencer already claimed')
      })

      it("isFraud = false frees up the sequencer's collateral", async () => {
        // override the fraud verifier
        await manager.setAddress('OVM_FraudVerifier', sender)

        const bondBefore = await bondManager.bonds(sender)
        await bondManager.finalize(preStateRoot, batchIdx, false)
        const reward = await bondManager.witnessProviders(preStateRoot)

        expect(reward.canClaim).to.be.false
        expect(
          await bondManager.sequencers(batchIdx),
          ethers.constants.AddressZero
        )
        expect(await bondManager.bonds(sender)).to.eq(bondBefore.add(amount))
        await expect(
          bondManager.finalize(preStateRoot, batchIdx, true)
        ).to.be.revertedWith('err: sequencer already claimed')
      })
    })
  })
})
