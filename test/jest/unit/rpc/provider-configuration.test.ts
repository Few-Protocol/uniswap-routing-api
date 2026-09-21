import PROD_CONFIG from '../../../../lib/config/rpcProviderProdConfig.json'
import { GlobalRpcProviders } from '../../../../lib/rpc/GlobalRpcProviders'

const networks: [number, string][] = [
  [1, 'eth-mainnet'],
  [999, 'hyperliquid-mainnet'],
  [56, 'bnb-mainnet'],
  [4326, 'megaeth-mainnet'],
  [42161, 'arb-mainnet'],
  [8453, 'base-mainnet'],
  [130, 'unichain-mainnet'],
  [10, 'opt-mainnet'],
  [196, 'xlayer-mainnet'],
  [11155111, 'eth-sepolia'],
  [4663, 'robinhood-mainnet'],
]

// Validate the actual registry through the existing resolver without making RPC calls.
const resolveConfig = () => GlobalRpcProviders['validateProdConfig'](JSON.parse(JSON.stringify(PROD_CONFIG)))

describe('configured Alchemy providers', () => {
  const originalEnv = process.env
  beforeEach(() => {
    process.env = { ALCHEMY_1: 'shared-test-key,second-test-key' }
  })
  afterEach(() => {
    process.env = originalEnv
  })

  test.each(networks)('chain %s uses the shared key with its own network endpoint', (chainId, network) => {
    const chain = resolveConfig().find((config) => config.chainId === chainId)!
    expect(chain.useMultiProviderProb).toBe(1)
    expect(chain.providerUrls).toEqual([`https://${network}.g.alchemy.com/v2/shared-test-key`])
  })

  test.each(networks)('chain %s honors its dedicated key before the shared key', (chainId, network) => {
    process.env[`ALCHEMY_${chainId}`] = 'dedicated-test-key'
    const chain = resolveConfig().find((config) => config.chainId === chainId)!
    expect(chain.providerUrls).toEqual([`https://${network}.g.alchemy.com/v2/dedicated-test-key`])
  })

  test('blank Robinhood key uses the existing shared-key fallback', () => {
    process.env.ALCHEMY_4663 = '  '
    expect(resolveConfig().find((config) => config.chainId === 4663)!.providerUrls).toEqual([
      'https://robinhood-mainnet.g.alchemy.com/v2/shared-test-key',
    ])
  })

  test('missing Robinhood credentials fail the existing validation', () => {
    process.env = Object.fromEntries(
      networks.filter(([chain]) => chain !== 1 && chain !== 4663).map(([chain]) => [`ALCHEMY_${chain}`, 'test-key'])
    )
    const robinhood = PROD_CONFIG.filter((config) => config.chainId === 4663)
    expect(() => GlobalRpcProviders['validateProdConfig'](JSON.parse(JSON.stringify(robinhood)))).toThrow(
      "Environmental variable ALCHEMY_4663 isn't defined or is empty!"
    )
  })
})
