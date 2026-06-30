import { ChainId } from '@ring-protocol/sdk-core'

export function chainIdToNetworkName(networkId: ChainId): string {
  switch (networkId) {
    case ChainId.MAINNET:
      return 'ethereum'
    case ChainId.ARBITRUM_ONE:
      return 'arbitrum'
    case ChainId.OPTIMISM:
      return 'optimism'
    case ChainId.POLYGON:
      return 'polygon'
    case ChainId.BNB:
      return 'smartchain'
    case ChainId.CELO:
      return 'celo'
    case ChainId.AVALANCHE:
      return 'avalanchec'
    case ChainId.BASE:
      return 'base'
    case ChainId.WORLDCHAIN:
      return 'worldchain'
    case ChainId.UNICHAIN_SEPOLIA:
      return 'unichain-sepolia'
    case ChainId.MONAD_TESTNET:
      return 'monad-testnet'
    case ChainId.BASE_SEPOLIA:
      return 'base-sepolia'
    case ChainId.UNICHAIN:
      return 'unichain'
    case ChainId.SONEIUM:
      return 'soneium'
    case ChainId.XLAYER_MAINNET:
      return 'xlayer'
    case ChainId.HYPER_MAINNET:
      return 'hyper'
    case ChainId.MEGAETH_MAINNET:
      return 'megaeth'
    default:
      return 'ethereum'
  }
}

export function generateProviderUrl(key: string, value: string, chainId: number): string {
  if (key === 'UNIRPC_0') {
    // UNIRPC_0 is a special case for the Uniswap RPC
    // - env value will contain the generic unirpc endpoint - no trailing '/'
    return `${value}/rpc/${chainId}`
  }

  const tokens = value.split(',')
  const alchemyNetworks: Record<string, string> = {
    ALCHEMY_1: 'eth-mainnet',
    ALCHEMY_10: 'opt-mainnet',
    ALCHEMY_56: 'bnb-mainnet',
    ALCHEMY_130: 'unichain-mainnet',
    ALCHEMY_137: 'polygon-mainnet',
    ALCHEMY_196: 'xlayer-mainnet',
    ALCHEMY_324: 'zksync-mainnet',
    ALCHEMY_999: 'hyperliquid-mainnet',
    ALCHEMY_1301: 'unichain-sepolia',
    ALCHEMY_8453: 'base-mainnet',
    ALCHEMY_81457: 'blast-mainnet',
    ALCHEMY_42161: 'arb-mainnet',
    ALCHEMY_43114: 'avax-mainnet',
    ALCHEMY_11155111: 'eth-sepolia',
    ALCHEMY_42220: 'celo-mainnet',
    ALCHEMY_4326: 'megaeth-mainnet',
  }

  const networkName = alchemyNetworks[key]
  if (networkName) {
    return `https://${networkName}.g.alchemy.com/v2/${tokens[0]}`
  }

  throw new Error(`Unknown provider-chainId pair: ${key}`)
}

export function getProviderId(chainId: ChainId, providerName: string): string {
  return `${chainId.toString()}_${providerName}`
}
