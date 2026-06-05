import { Contract } from '@ethersproject/contracts'
import { Provider } from '@ethersproject/providers'
import { isSusdrAutoRingV2PoolsEnabled } from './config'
import { SusdrV2PoolConfig } from './types'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const FEW_FACTORY_ABI = ['function getWrappedToken(address originalToken) view returns (address)']
const V2_FACTORY_ABI = ['function getPair(address tokenA, address tokenB) view returns (address pair)']

const DEFAULT_MAINNET_RING_V2_FACTORY = '0xeb2a625b704d73e82946d8d026e1f588eed06416'
const DEFAULT_MAINNET_FEW_FACTORY = '0x7d86394139bf1122e82fdf45bb4e3b038a4464dd'
const DEFAULT_POOL_MAX_SLIPPAGE_BPS = 50
const DEFAULT_MAINNET_ORIGINAL_TOKENS = [
  { symbol: 'WETH', address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' },
  { symbol: 'WBTC', address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599' },
  { symbol: 'USDT', address: '0xdac17f958d2ee523a2206206994597c13d831ec7' },
  { symbol: 'DAI', address: '0x6b175474e89094c44da98b954eedeac495271d0f' },
  { symbol: 'USDC', address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' },
]

function isNonZeroAddress(address: string): boolean {
  return address.toLowerCase() !== ZERO_ADDRESS
}

function mainnetRingV2Factory(env: NodeJS.ProcessEnv): string {
  return env.SUSDR_RING_V2_FACTORY_ADDRESS ?? DEFAULT_MAINNET_RING_V2_FACTORY
}

function mainnetFewFactory(env: NodeJS.ProcessEnv): string {
  return env.SUSDR_FEW_FACTORY_ADDRESS ?? DEFAULT_MAINNET_FEW_FACTORY
}

export async function resolveDefaultSusdrV2PoolConfigs(
  provider: Provider,
  chainId: number,
  env: NodeJS.ProcessEnv = process.env
): Promise<SusdrV2PoolConfig[]> {
  if (!isSusdrAutoRingV2PoolsEnabled(env) || chainId !== 1) {
    return []
  }

  const fewFactory = new Contract(mainnetFewFactory(env), FEW_FACTORY_ABI, provider)
  const v2Factory = new Contract(mainnetRingV2Factory(env), V2_FACTORY_ABI, provider)
  const wrappedTokens = await Promise.all(
    DEFAULT_MAINNET_ORIGINAL_TOKENS.map(async (token) => ({
      ...token,
      wrappedAddress: (await fewFactory.getWrappedToken(token.address)) as string,
    }))
  )
  const configs: SusdrV2PoolConfig[] = []

  for (let i = 0; i < wrappedTokens.length; i += 1) {
    for (let j = i + 1; j < wrappedTokens.length; j += 1) {
      const tokenA = wrappedTokens[i]
      const tokenB = wrappedTokens[j]
      if (!isNonZeroAddress(tokenA.wrappedAddress) || !isNonZeroAddress(tokenB.wrappedAddress)) {
        continue
      }

      const pairAddress = (await v2Factory.getPair(tokenA.wrappedAddress, tokenB.wrappedAddress)) as string
      if (!isNonZeroAddress(pairAddress)) {
        continue
      }

      configs.push({
        poolAddress: pairAddress,
        label: `fw${tokenA.symbol}/fw${tokenB.symbol}`,
        capacityMode: 'full-reserve',
        teamAddresses: [],
        usableTeamLpBps: 10_000,
        maxSlippageBps: DEFAULT_POOL_MAX_SLIPPAGE_BPS,
      })
    }
  }

  return configs
}
