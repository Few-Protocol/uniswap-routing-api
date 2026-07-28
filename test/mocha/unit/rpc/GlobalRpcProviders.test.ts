import { GlobalRpcProviders } from '../../../../lib/rpc/GlobalRpcProviders'
import { default as bunyan, default as Logger } from 'bunyan'
import { ChainId } from '@ring-protocol/sdk-core'
import { expect } from 'chai'
import { SingleJsonRpcProviderConfig, UniJsonRpcProviderConfig } from '../../../../lib/rpc/config'
import Sinon, { SinonSandbox } from 'sinon'
import TEST_PROD_CONFIG from './rpcProviderTestProdConfig.json'

const log: Logger = bunyan.createLogger({ name: 'test' })

const UNI_PROVIDER_TEST_CONFIG: UniJsonRpcProviderConfig = {
  HEALTH_EVALUATION_WAIT_PERIOD_IN_S: 5,
  ENABLE_SHADOW_LATENCY_EVALUATION: false,
  LATENCY_EVALUATION_WAIT_PERIOD_IN_S: 15,
  DEFAULT_INITIAL_WEIGHT: 1000,
}

const SINGLE_PROVIDER_TEST_CONFIG: SingleJsonRpcProviderConfig = {
  HEALTH_EVALUATION_WAIT_PERIOD_IN_S: 5,
  ERROR_PENALTY: -50,
  HIGH_LATENCY_PENALTY: -50,
  HEALTH_SCORE_FALLBACK_THRESHOLD: -70,
  HEALTH_SCORE_RECOVER_THRESHOLD: -10,
  MAX_LATENCY_ALLOWED_IN_MS: 500,
  RECOVER_SCORE_PER_MS: 0.005,
  RECOVER_MAX_WAIT_TIME_TO_ACKNOWLEDGE_IN_MS: 20000,
  DB_SYNC_INTERVAL_IN_S: 5,
  LATENCY_STAT_HISTORY_WINDOW_LENGTH_IN_S: 300,
  LATENCY_EVALUATION_WAIT_PERIOD_IN_S: 15,
}

const cleanUp = () => {
  GlobalRpcProviders['UNI_RPC_PROVIDERS'] = null
  GlobalRpcProviders['SINGLE_RPC_PROVIDERS'] = null
}

describe('GlobalRpcProviders', () => {
  let sandbox: SinonSandbox

  beforeEach(() => {
    sandbox = Sinon.createSandbox()
  })

  afterEach(() => {
    sandbox.restore()
    cleanUp()
  })

  it('Prepare global UniJsonRpcProvider by reading given config', () => {
    process.env = {
      ALCHEMY_43114: 'key0',
    }
    const rpcProviderProdConfig = [
      { chainId: 1, useMultiProviderProb: 0 },
      {
        chainId: 43114,
        useMultiProviderProb: 1,
        sessionAllowProviderFallbackWhenUnhealthy: true,
        providerInitialWeights: [2],
        providerUrls: ['ALCHEMY_43114'],
        providerNames: ['ALCHEMY'],
      },
    ]

    expect(
      GlobalRpcProviders.getGlobalUniRpcProviders(
        log,
        UNI_PROVIDER_TEST_CONFIG,
        SINGLE_PROVIDER_TEST_CONFIG,
        rpcProviderProdConfig
      ).has(ChainId.MAINNET)
    ).to.be.false

    expect(
      GlobalRpcProviders.getGlobalUniRpcProviders(
        log,
        UNI_PROVIDER_TEST_CONFIG,
        SINGLE_PROVIDER_TEST_CONFIG,
        rpcProviderProdConfig
      ).has(ChainId.BNB)
    ).to.be.false

    expect(
      GlobalRpcProviders.getGlobalUniRpcProviders(
        log,
        UNI_PROVIDER_TEST_CONFIG,
        SINGLE_PROVIDER_TEST_CONFIG,
        rpcProviderProdConfig
      ).has(ChainId.AVALANCHE)
    ).to.be.true

    const avaUniProvider = GlobalRpcProviders.getGlobalUniRpcProviders(
      log,
      UNI_PROVIDER_TEST_CONFIG,
      SINGLE_PROVIDER_TEST_CONFIG,
      rpcProviderProdConfig
    ).get(ChainId.AVALANCHE)!
    const url0 = 'https://avax-mainnet.g.alchemy.com/v2/key0'
    expect(avaUniProvider['sessionAllowProviderFallbackWhenUnhealthy']).to.be.true
    expect(avaUniProvider['urlWeight']).to.deep.equal({ [url0]: 2 })
    expect(avaUniProvider['providers'][0].url).to.equal(url0)
  })

  it('Prepare global UniJsonRpcProvider by reading config: Use prob to decide feature switch', () => {
    process.env = {
      ALCHEMY_10: 'key0',
      ALCHEMY_43114: 'key2',
    }

    const rpcProviderProdConfig = [
      {
        chainId: 10,
        useMultiProviderProb: 0.3,
        providerUrls: ['ALCHEMY_10'],
        providerNames: ['ALCHEMY'],
      },
      {
        chainId: 43114,
        useMultiProviderProb: 0.7,
        sessionAllowProviderFallbackWhenUnhealthy: true,
        providerInitialWeights: [2],
        providerUrls: ['ALCHEMY_43114'],
        providerNames: ['ALCHEMY'],
      },
    ]

    const randStub = sandbox.stub(Math, 'random')
    randStub.returns(0.0)
    expect(
      GlobalRpcProviders.getGlobalUniRpcProviders(
        log,
        UNI_PROVIDER_TEST_CONFIG,
        SINGLE_PROVIDER_TEST_CONFIG,
        rpcProviderProdConfig
      ).has(ChainId.OPTIMISM)
    ).to.be.true
    expect(
      GlobalRpcProviders.getGlobalUniRpcProviders(
        log,
        UNI_PROVIDER_TEST_CONFIG,
        SINGLE_PROVIDER_TEST_CONFIG,
        rpcProviderProdConfig
      ).has(ChainId.AVALANCHE)
    ).to.be.true
    cleanUp()

    randStub.returns(0.29)
    expect(
      GlobalRpcProviders.getGlobalUniRpcProviders(
        log,
        UNI_PROVIDER_TEST_CONFIG,
        SINGLE_PROVIDER_TEST_CONFIG,
        rpcProviderProdConfig
      ).has(ChainId.OPTIMISM)
    ).to.be.true
    expect(
      GlobalRpcProviders.getGlobalUniRpcProviders(
        log,
        UNI_PROVIDER_TEST_CONFIG,
        SINGLE_PROVIDER_TEST_CONFIG,
        rpcProviderProdConfig
      ).has(ChainId.AVALANCHE)
    ).to.be.true
    cleanUp()

    randStub.returns(0.3)
    expect(
      GlobalRpcProviders.getGlobalUniRpcProviders(
        log,
        UNI_PROVIDER_TEST_CONFIG,
        SINGLE_PROVIDER_TEST_CONFIG,
        rpcProviderProdConfig
      ).has(ChainId.OPTIMISM)
    ).to.be.false
    expect(
      GlobalRpcProviders.getGlobalUniRpcProviders(
        log,
        UNI_PROVIDER_TEST_CONFIG,
        SINGLE_PROVIDER_TEST_CONFIG,
        rpcProviderProdConfig
      ).has(ChainId.AVALANCHE)
    ).to.be.true
    cleanUp()

    randStub.returns(0.69)
    expect(
      GlobalRpcProviders.getGlobalUniRpcProviders(
        log,
        UNI_PROVIDER_TEST_CONFIG,
        SINGLE_PROVIDER_TEST_CONFIG,
        rpcProviderProdConfig
      ).has(ChainId.OPTIMISM)
    ).to.be.false
    expect(
      GlobalRpcProviders.getGlobalUniRpcProviders(
        log,
        UNI_PROVIDER_TEST_CONFIG,
        SINGLE_PROVIDER_TEST_CONFIG,
        rpcProviderProdConfig
      ).has(ChainId.AVALANCHE)
    ).to.be.true
    cleanUp()

    randStub.returns(0.7)
    expect(
      GlobalRpcProviders.getGlobalUniRpcProviders(
        log,
        UNI_PROVIDER_TEST_CONFIG,
        SINGLE_PROVIDER_TEST_CONFIG,
        rpcProviderProdConfig
      ).has(ChainId.OPTIMISM)
    ).to.be.false
    expect(
      GlobalRpcProviders.getGlobalUniRpcProviders(
        log,
        UNI_PROVIDER_TEST_CONFIG,
        SINGLE_PROVIDER_TEST_CONFIG,
        rpcProviderProdConfig
      ).has(ChainId.AVALANCHE)
    ).to.be.false
    cleanUp()

    randStub.returns(0.9)
    expect(
      GlobalRpcProviders.getGlobalUniRpcProviders(
        log,
        UNI_PROVIDER_TEST_CONFIG,
        SINGLE_PROVIDER_TEST_CONFIG,
        rpcProviderProdConfig
      ).has(ChainId.OPTIMISM)
    ).to.be.false
    expect(
      GlobalRpcProviders.getGlobalUniRpcProviders(
        log,
        UNI_PROVIDER_TEST_CONFIG,
        SINGLE_PROVIDER_TEST_CONFIG,
        rpcProviderProdConfig
      ).has(ChainId.AVALANCHE)
    ).to.be.false
    cleanUp()
  })

  it('Prepare global UniJsonRpcProvider by reading config file', () => {
    process.env = {
      ALCHEMY_43114: 'key0',
      ALCHEMY_10: 'key5',
      ALCHEMY_42220: 'key6',
      ALCHEMY_56: 'key8',
      ALCHEMY_137: 'key11',
      ALCHEMY_8453: '',
      ALCHEMY_11155111: 'key17',
      ALCHEMY_42161: 'key21',
      ALCHEMY_1: 'key25',
      ALCHEMY_81457: 'key27',
      UNIRPC_0: 'key28',
    }

    const randStub = sandbox.stub(Math, 'random')
    randStub.returns(0.0)

    const uniRpcProviderCelo = GlobalRpcProviders.getGlobalUniRpcProviders(
      log,
      UNI_PROVIDER_TEST_CONFIG,
      SINGLE_PROVIDER_TEST_CONFIG,
      TEST_PROD_CONFIG
    ).get(ChainId.CELO)!!
    expect(uniRpcProviderCelo['providers'][0].url).equal('https://celo-mainnet.g.alchemy.com/v2/key6')

    const sepoliaRpcProvider = GlobalRpcProviders.getGlobalUniRpcProviders(
      log,
      UNI_PROVIDER_TEST_CONFIG,
      SINGLE_PROVIDER_TEST_CONFIG,
      TEST_PROD_CONFIG
    ).get(ChainId.SEPOLIA)!!
    expect(sepoliaRpcProvider['providers'][0].url).equal('https://eth-sepolia.g.alchemy.com/v2/key17')

    const arbitrumRpcProvider = GlobalRpcProviders.getGlobalUniRpcProviders(
      log,
      UNI_PROVIDER_TEST_CONFIG,
      SINGLE_PROVIDER_TEST_CONFIG,
      TEST_PROD_CONFIG
    ).get(ChainId.ARBITRUM_ONE)!!
    expect(arbitrumRpcProvider['providers'][0].url).equal('https://arb-mainnet.g.alchemy.com/v2/key21')

    const baseRpcProvider = GlobalRpcProviders.getGlobalUniRpcProviders(
      log,
      UNI_PROVIDER_TEST_CONFIG,
      SINGLE_PROVIDER_TEST_CONFIG,
      TEST_PROD_CONFIG
    ).get(ChainId.BASE)!!
    expect(baseRpcProvider['providers'][0].url).equal('https://base-mainnet.g.alchemy.com/v2/key25')

    const ethRpcProvider = GlobalRpcProviders.getGlobalUniRpcProviders(
      log,
      UNI_PROVIDER_TEST_CONFIG,
      SINGLE_PROVIDER_TEST_CONFIG,
      TEST_PROD_CONFIG
    ).get(ChainId.MAINNET)!!
    expect(ethRpcProvider['providers'][0].url).equal('https://eth-mainnet.g.alchemy.com/v2/key25')

    const blastRpcProvider = GlobalRpcProviders.getGlobalUniRpcProviders(
      log,
      UNI_PROVIDER_TEST_CONFIG,
      SINGLE_PROVIDER_TEST_CONFIG,
      TEST_PROD_CONFIG
    ).get(ChainId.BLAST)!!
    expect(blastRpcProvider['providers'][0].url).equal('https://blast-mainnet.g.alchemy.com/v2/key27')

    cleanUp()
  })
})
