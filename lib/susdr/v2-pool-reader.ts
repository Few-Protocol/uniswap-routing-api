import { BigNumber } from '@ethersproject/bignumber'
import { Contract } from '@ethersproject/contracts'
import { Provider } from '@ethersproject/providers'
import { formatRawAmount } from './amount'
import { BPS_DENOMINATOR, SusdrV2PoolConfig, SusdrV2PoolSnapshot } from './types'

const ERC20_ABI = ['function symbol() view returns (string)', 'function decimals() view returns (uint8)']
const V2_PAIR_ABI = [
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
]
const V2_FEE_BPS = 9_970
const V2_FEE_NUMERATOR = BigNumber.from(997)
const V2_FEE_DENOMINATOR = BigNumber.from(1_000)

function clampBps(value: number): number {
  return Math.max(0, Math.min(BPS_DENOMINATOR, value))
}

function reserveShare(reserve: BigNumber, shareBps: number): BigNumber {
  return reserve.mul(shareBps).div(BPS_DENOMINATOR)
}

function maxInputForSlippage(reserveIn: BigNumber, maxSlippageBps: number): BigNumber {
  const slippageBps = clampBps(maxSlippageBps)
  const allowedExecutionPriceBps = BPS_DENOMINATOR - slippageBps
  if (V2_FEE_BPS <= allowedExecutionPriceBps) {
    return BigNumber.from(0)
  }

  // Slippage is total execution slippage versus spot, including the V2 0.3% fee.
  return reserveIn
    .mul(V2_FEE_BPS - allowedExecutionPriceBps)
    .mul(BPS_DENOMINATOR)
    .div(allowedExecutionPriceBps)
    .div(V2_FEE_BPS)
}

function getAmountOut(amountIn: BigNumber, reserveIn: BigNumber, reserveOut: BigNumber): BigNumber {
  if (amountIn.isZero() || reserveIn.isZero() || reserveOut.isZero()) {
    return BigNumber.from(0)
  }

  const amountInWithFee = amountIn.mul(V2_FEE_NUMERATOR)
  return amountInWithFee.mul(reserveOut).div(reserveIn.mul(V2_FEE_DENOMINATOR).add(amountInWithFee))
}

async function readTokenMetadata(provider: Provider, address: string): Promise<{ symbol: string; decimals: number }> {
  const token = new Contract(address, ERC20_ABI, provider)

  try {
    const [symbol, decimals] = await Promise.all([token.symbol(), token.decimals()])
    return {
      symbol: typeof symbol === 'string' && symbol.length > 0 ? symbol : address,
      decimals: Number(decimals),
    }
  } catch {
    return {
      symbol: address,
      decimals: 18,
    }
  }
}

export async function readV2PoolSnapshot(provider: Provider, config: SusdrV2PoolConfig): Promise<SusdrV2PoolSnapshot> {
  const pair = new Contract(config.poolAddress, V2_PAIR_ABI, provider)
  const capacityMode = config.capacityMode ?? 'team-lp'
  const teamAddresses = config.teamAddresses ?? []

  const [token0, token1, reserves, totalSupply, blockNumber, teamBalances] = await Promise.all([
    pair.token0(),
    pair.token1(),
    pair.getReserves(),
    pair.totalSupply(),
    provider.getBlockNumber(),
    capacityMode === 'team-lp' ? Promise.all(teamAddresses.map((address) => pair.balanceOf(address))) : [],
  ])

  const reserve0 = BigNumber.from(reserves[0])
  const reserve1 = BigNumber.from(reserves[1])
  const totalSupplyAmount = BigNumber.from(totalSupply)
  const teamBalanceAmounts = teamBalances as Array<BigNumber | string>
  const teamLp = teamBalanceAmounts.reduce(
    (total: BigNumber, balance: BigNumber | string) => total.add(BigNumber.from(balance)),
    BigNumber.from(0)
  )
  const teamLpShareBps =
    capacityMode === 'full-reserve'
      ? BPS_DENOMINATOR
      : totalSupplyAmount.isZero()
      ? 0
      : teamLp.mul(BPS_DENOMINATOR).div(totalSupplyAmount).toNumber()
  const usableTeamLpBps =
    capacityMode === 'full-reserve' ? BPS_DENOMINATOR : Math.min(teamLpShareBps, clampBps(config.usableTeamLpBps ?? 0))
  const maxSlippageBps = capacityMode === 'full-reserve' ? clampBps(config.maxSlippageBps ?? 50) : 0
  const usableInput0 =
    capacityMode === 'full-reserve'
      ? maxInputForSlippage(reserve0, maxSlippageBps)
      : reserveShare(reserve0, usableTeamLpBps)
  const usableInput1 =
    capacityMode === 'full-reserve'
      ? maxInputForSlippage(reserve1, maxSlippageBps)
      : reserveShare(reserve1, usableTeamLpBps)
  const usableReserve0 =
    capacityMode === 'full-reserve'
      ? getAmountOut(usableInput1, reserve1, reserve0)
      : reserveShare(reserve0, usableTeamLpBps)
  const usableReserve1 =
    capacityMode === 'full-reserve'
      ? getAmountOut(usableInput0, reserve0, reserve1)
      : reserveShare(reserve1, usableTeamLpBps)
  const [token0Metadata, token1Metadata] = await Promise.all([
    readTokenMetadata(provider, token0),
    readTokenMetadata(provider, token1),
  ])

  return {
    poolAddress: config.poolAddress,
    label: config.label,
    capacityMode,
    token0,
    token1,
    token0Symbol: token0Metadata.symbol,
    token1Symbol: token1Metadata.symbol,
    token0Decimals: token0Metadata.decimals,
    token1Decimals: token1Metadata.decimals,
    reserve0Raw: reserve0.toString(),
    reserve1Raw: reserve1.toString(),
    reserve0Decimal: formatRawAmount(reserve0, token0Metadata.decimals),
    reserve1Decimal: formatRawAmount(reserve1, token1Metadata.decimals),
    totalSupplyRaw: totalSupplyAmount.toString(),
    teamLpRaw: capacityMode === 'full-reserve' ? totalSupplyAmount.toString() : teamLp.toString(),
    teamLpShareBps,
    usableTeamLpBps,
    maxSlippageBps,
    usableInput0Raw: usableInput0.toString(),
    usableInput1Raw: usableInput1.toString(),
    usableReserve0Raw: usableReserve0.toString(),
    usableReserve1Raw: usableReserve1.toString(),
    usableInput0Decimal: formatRawAmount(usableInput0, token0Metadata.decimals),
    usableInput1Decimal: formatRawAmount(usableInput1, token1Metadata.decimals),
    usableReserve0Decimal: formatRawAmount(usableReserve0, token0Metadata.decimals),
    usableReserve1Decimal: formatRawAmount(usableReserve1, token1Metadata.decimals),
    blockNumber,
  }
}
