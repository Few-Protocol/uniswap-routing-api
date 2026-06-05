import { BigNumber } from '@ethersproject/bignumber'
import { Contract } from '@ethersproject/contracts'
import { Provider } from '@ethersproject/providers'
import { SusdrLiquiditySource, SusdrLiquiditySourceConfig } from './types'

const ERC20_ABI = ['function balanceOf(address owner) view returns (uint256)']

function minBigNumber(left: BigNumber, right: BigNumber): BigNumber {
  return left.lt(right) ? left : right
}

async function readLiquiditySource(
  provider: Provider,
  config: SusdrLiquiditySourceConfig
): Promise<SusdrLiquiditySource> {
  if (config.readType === 'erc20-balance') {
    const token = new Contract(config.tokenAddress!, ERC20_ABI, provider)
    const amount = await token.balanceOf(config.holderAddress!)
    return {
      id: config.id,
      kind: config.kind,
      label: config.label,
      amountRaw: amount.toString(),
      decimals: config.decimals,
      enabled: config.enabled,
    }
  }

  const aToken = new Contract(config.aTokenAddress!, ERC20_ABI, provider)
  const underlyingToken = new Contract(config.tokenAddress!, ERC20_ABI, provider)
  const [ownerATokenBalance, poolUnderlyingLiquidity] = await Promise.all([
    aToken.balanceOf(config.ownerAddress!),
    underlyingToken.balanceOf(config.aTokenAddress!),
  ])
  const amount = minBigNumber(BigNumber.from(ownerATokenBalance), BigNumber.from(poolUnderlyingLiquidity))
  return {
    id: config.id,
    kind: config.kind,
    label: config.label,
    amountRaw: amount.toString(),
    decimals: config.decimals,
    enabled: config.enabled,
  }
}

export async function readLiquiditySources(
  provider: Provider,
  configs: SusdrLiquiditySourceConfig[]
): Promise<SusdrLiquiditySource[]> {
  return Promise.all(
    configs.filter((config) => config.enabled !== false).map((config) => readLiquiditySource(provider, config))
  )
}
