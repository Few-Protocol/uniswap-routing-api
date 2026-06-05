import { BigNumber } from '@ethersproject/bignumber'
import { Contract } from '@ethersproject/contracts'
import { Provider } from '@ethersproject/providers'
import { buildSusdrReadOnlyProvider, getSusdrRpcUrl } from './config'
import { DEFAULT_SUSDR_SOURCE_APY_QUOTES_BY_ASSET_ID } from './risk'
import { SusdrRiskInput, SusdrYieldQuote } from './types'

const AAVE_V3_POOL_ABI = [
  'function getReserveData(address asset) view returns ((uint256 configuration,uint128 liquidityIndex,uint128 currentLiquidityRate,uint128 variableBorrowIndex,uint128 currentVariableBorrowRate,uint128 currentStableBorrowRate,uint40 lastUpdateTimestamp,uint16 id,address aTokenAddress,address stableDebtTokenAddress,address variableDebtTokenAddress,address interestRateStrategyAddress,uint128 accruedToTreasury,uint128 unbacked,uint128 isolationModeTotalDebt))',
]
const APYX_RATE_VIEW_ABI = ['function apy() view returns (uint256)', 'function precision() view returns (uint256)']
const SATURN_SUSDAT_ABI = [
  'function totalAssets() view returns (uint256)',
  'function vestingAmount() view returns (uint256)',
  'function vestingPeriod() view returns (uint256)',
  'function usdatBalance() view returns (uint256)',
  'function paused() view returns (bool)',
]
const PRICE_ORACLE_ABI = ['function getPrice() view returns (uint256)', 'function decimals() view returns (uint8)']

const RAY = BigNumber.from('1000000000000000000000000000')
const BPS = 10_000
const SECONDS_PER_DAY = 86_400

const DEFAULT_AAVE_V3_POOL_ADDRESS = '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2'
const DEFAULT_AAVE_USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const DEFAULT_SATURN_SUSDAT_ADDRESS = '0xD166337499E176bbC38a1FBd113Ab144e5bd2Df7'
const DEFAULT_SATURN_STRC_PRICE_ORACLE_ADDRESS = '0x5f7eCD0D045c393da6cb6c933c671AC305A871BF'
const DEFAULT_SATURN_STRC_PRICE_ORACLE_DECIMALS = 8
const DEFAULT_APYX_RATE_VIEW_ADDRESS = '0xCABa36EDE2C08e16F3602e8688a8bE94c1B4e484'
const YIELD_ASSET_IDS = ['aave-usdc', 'sUSDat', 'apyUSD']

type CachedYieldRiskInput = {
  input: SusdrRiskInput
  fetchedAtMs: number
  key: string
}

type YieldReadOutcome = {
  quote: SusdrYieldQuote
  pausedExternalAssetCount?: number
}

type AaveReserveData = {
  currentLiquidityRate?: BigNumber
  [index: number]: BigNumber | undefined
}

let cachedYieldRiskInput: CachedYieldRiskInput | undefined

function cacheTtlMs(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const parsed = Number(env[key] ?? fallback)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function yieldCacheKey(chainId: number, env: NodeJS.ProcessEnv): string {
  return [
    chainId,
    getSusdrRpcUrl(chainId, env) ? 'rpc' : 'missing-rpc',
    env.SUSDR_AAVE_V3_POOL_ADDRESS ?? DEFAULT_AAVE_V3_POOL_ADDRESS,
    env.SUSDR_AAVE_USDC_ADDRESS ?? DEFAULT_AAVE_USDC_ADDRESS,
    env.SUSDR_SATURN_SUSDAT_ADDRESS ?? DEFAULT_SATURN_SUSDAT_ADDRESS,
    env.SUSDR_SATURN_STRC_PRICE_ORACLE_ADDRESS ?? DEFAULT_SATURN_STRC_PRICE_ORACLE_ADDRESS,
    env.SUSDR_APYX_RATE_VIEW_ADDRESS ?? DEFAULT_APYX_RATE_VIEW_ADDRESS,
  ].join('|')
}

function readCachedYieldRiskInput(nowMs: number, key: string, maxAgeMs: number): SusdrRiskInput | undefined {
  if (!cachedYieldRiskInput || cachedYieldRiskInput.key !== key || nowMs - cachedYieldRiskInput.fetchedAtMs > maxAgeMs) {
    return undefined
  }

  return cachedYieldRiskInput.input
}

function fallbackQuote(assetId: string): SusdrYieldQuote {
  return {
    ...DEFAULT_SUSDR_SOURCE_APY_QUOTES_BY_ASSET_ID[assetId],
  }
}

function fallbackYieldInput(assetIds: string[]): SusdrRiskInput {
  return {
    sourceApyByAssetId: assetIds.reduce<Record<string, SusdrYieldQuote>>((quotes, assetId) => {
      quotes[assetId] = fallbackQuote(assetId)
      return quotes
    }, {}),
    sourceApyFallbackAssetIds: assetIds,
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`${label} timeout`)), timeoutMs)
    promise.then(
      (value) => {
        clearTimeout(timeout)
        resolve(value)
      },
      (error) => {
        clearTimeout(timeout)
        reject(error)
      }
    )
  })
}

export function scaledRatioToBps(value: BigNumber, precision: BigNumber): number {
  if (precision.lte(0)) {
    return 0
  }

  return value.mul(BPS).add(precision.div(2)).div(precision).toNumber()
}

export function aaveLiquidityRateRayToBps(currentLiquidityRate: BigNumber): number {
  return scaledRatioToBps(currentLiquidityRate, RAY)
}

function uintToNumber(value: BigNumber | number): number {
  return BigNumber.isBigNumber(value) ? value.toNumber() : value
}

function fallbackOracleDecimals(env: NodeJS.ProcessEnv): number {
  const parsed = Number(env.SUSDR_SATURN_STRC_PRICE_ORACLE_DECIMALS ?? DEFAULT_SATURN_STRC_PRICE_ORACLE_DECIMALS)
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 36 ? parsed : DEFAULT_SATURN_STRC_PRICE_ORACLE_DECIMALS
}

async function readOracleDecimals(oracle: Contract, env: NodeJS.ProcessEnv): Promise<number> {
  try {
    return uintToNumber((await oracle.decimals()) as BigNumber | number)
  } catch {
    return fallbackOracleDecimals(env)
  }
}

export function calculateSaturnSusdatApyBps({
  strcPrice,
  totalAssetsRaw,
  usdatBalanceRaw,
  vestingAmountRaw,
  vestingPeriodSeconds,
}: {
  strcPrice: number
  totalAssetsRaw: BigNumber
  usdatBalanceRaw: BigNumber
  vestingAmountRaw: BigNumber
  vestingPeriodSeconds: number
}): number | undefined {
  const totalAssets = Number(totalAssetsRaw.toString())
  const usdatBalance = Number(usdatBalanceRaw.toString())
  const vestingAmount = Number(vestingAmountRaw.toString())
  const vestingDays = vestingPeriodSeconds / SECONDS_PER_DAY

  if (
    !Number.isFinite(totalAssets) ||
    !Number.isFinite(usdatBalance) ||
    !Number.isFinite(vestingAmount) ||
    !Number.isFinite(strcPrice) ||
    totalAssets <= 0 ||
    vestingAmount <= 0 ||
    strcPrice <= 0 ||
    vestingDays <= 0
  ) {
    return undefined
  }

  const dividendComponent = ((vestingAmount * strcPrice) / totalAssets) * (365 / vestingDays) * 100
  const strcShare = Math.max(0, (totalAssets - usdatBalance) / totalAssets)
  const discountComponent = strcPrice < 100 ? ((100 - strcPrice) / strcPrice) * strcShare * 100 : 0

  return Math.round((dividendComponent + discountComponent) * 100)
}

async function readAaveUsdcYieldQuote(
  provider: Provider,
  env: NodeJS.ProcessEnv,
  nowMs: number
): Promise<YieldReadOutcome> {
  const pool = new Contract(env.SUSDR_AAVE_V3_POOL_ADDRESS ?? DEFAULT_AAVE_V3_POOL_ADDRESS, AAVE_V3_POOL_ABI, provider)
  const reserveData = (await pool.getReserveData(
    env.SUSDR_AAVE_USDC_ADDRESS ?? DEFAULT_AAVE_USDC_ADDRESS
  )) as AaveReserveData
  const currentLiquidityRate = reserveData.currentLiquidityRate ?? reserveData[2]

  if (!currentLiquidityRate) {
    throw new Error('Missing Aave currentLiquidityRate')
  }

  return {
    quote: {
      sourceApyBps: aaveLiquidityRateRayToBps(currentLiquidityRate),
      sourceApyKind: 'live',
      sourceApySource: 'aave-v3-usdc-current-liquidity-rate',
      sourceApyUpdatedAtMs: nowMs,
      sourceApyDetail: 'Aave V3 Pool.getReserveData(USDC).currentLiquidityRate',
    },
  }
}

async function readSaturnSusdatYieldQuote(
  provider: Provider,
  env: NodeJS.ProcessEnv,
  nowMs: number
): Promise<YieldReadOutcome> {
  const susdat = new Contract(env.SUSDR_SATURN_SUSDAT_ADDRESS ?? DEFAULT_SATURN_SUSDAT_ADDRESS, SATURN_SUSDAT_ABI, provider)
  const strcPriceOracle = new Contract(
    env.SUSDR_SATURN_STRC_PRICE_ORACLE_ADDRESS ?? DEFAULT_SATURN_STRC_PRICE_ORACLE_ADDRESS,
    PRICE_ORACLE_ABI,
    provider
  )
  const [totalAssetsRaw, vestingAmountRaw, vestingPeriodRaw, usdatBalanceRaw, paused, priceRaw, priceDecimals] =
    (await Promise.all([
      susdat.totalAssets(),
      susdat.vestingAmount(),
      susdat.vestingPeriod(),
      susdat.usdatBalance(),
      susdat.paused(),
      strcPriceOracle.getPrice(),
      readOracleDecimals(strcPriceOracle, env),
    ])) as [BigNumber, BigNumber, BigNumber, BigNumber, boolean, BigNumber, number]
  const strcPrice = Number(priceRaw.toString()) / 10 ** priceDecimals
  const sourceApyBps = calculateSaturnSusdatApyBps({
    strcPrice,
    totalAssetsRaw,
    usdatBalanceRaw,
    vestingAmountRaw,
    vestingPeriodSeconds: vestingPeriodRaw.toNumber(),
  })

  if (sourceApyBps === undefined) {
    throw new Error('Missing Saturn sUSDat APY inputs')
  }

  return {
    pausedExternalAssetCount: paused ? 1 : 0,
    quote: {
      sourceApyBps,
      sourceApyKind: 'live',
      sourceApySource: 'saturn-susdat-onchain',
      sourceApyUpdatedAtMs: nowMs,
      sourceApyDetail: 'sUSDat totalAssets, vestingAmount, vestingPeriod, USDat balance, STRC oracle price',
    },
  }
}

async function readApyxApyUsdYieldQuote(
  provider: Provider,
  env: NodeJS.ProcessEnv,
  nowMs: number
): Promise<YieldReadOutcome> {
  const rateView = new Contract(
    env.SUSDR_APYX_RATE_VIEW_ADDRESS ?? DEFAULT_APYX_RATE_VIEW_ADDRESS,
    APYX_RATE_VIEW_ABI,
    provider
  )
  const [apy, precision] = (await Promise.all([rateView.apy(), rateView.precision()])) as [BigNumber, BigNumber]

  return {
    quote: {
      sourceApyBps: scaledRatioToBps(apy, precision),
      sourceApyKind: 'live',
      sourceApySource: 'apyx-rate-view',
      sourceApyUpdatedAtMs: nowMs,
      sourceApyDetail: 'ApyUSDRateView.apy()',
    },
  }
}

async function readQuoteOrFallback(
  assetId: string,
  reader: () => Promise<YieldReadOutcome>,
  timeoutMs: number
): Promise<{ assetId: string; fallback: boolean; outcome: YieldReadOutcome }> {
  try {
    const outcome = await withTimeout(reader(), timeoutMs, assetId)
    return { assetId, fallback: false, outcome }
  } catch {
    return { assetId, fallback: true, outcome: { quote: fallbackQuote(assetId) } }
  }
}

export function clearSusdrYieldDataCacheForTest(): void {
  cachedYieldRiskInput = undefined
}

export async function readSusdrYieldRiskInput(
  chainId = 1,
  env: NodeJS.ProcessEnv = process.env,
  nowMs: number = Date.now()
): Promise<SusdrRiskInput> {
  if (env.SUSDR_DISABLE_YIELD_DATA === 'true') {
    return fallbackYieldInput(YIELD_ASSET_IDS)
  }

  const key = yieldCacheKey(chainId, env)
  const freshCache = readCachedYieldRiskInput(nowMs, key, cacheTtlMs(env, 'SUSDR_YIELD_DATA_CACHE_TTL_MS', 30_000))
  if (freshCache) {
    return freshCache
  }

  if (!getSusdrRpcUrl(chainId, env)) {
    return fallbackYieldInput(YIELD_ASSET_IDS)
  }

  const provider = buildSusdrReadOnlyProvider(chainId, env)
  const timeoutMs = cacheTtlMs(env, 'SUSDR_YIELD_DATA_TIMEOUT_MS', 7000)
  const results = await Promise.all([
    readQuoteOrFallback('aave-usdc', () => readAaveUsdcYieldQuote(provider, env, nowMs), timeoutMs),
    readQuoteOrFallback('sUSDat', () => readSaturnSusdatYieldQuote(provider, env, nowMs), timeoutMs),
    readQuoteOrFallback('apyUSD', () => readApyxApyUsdYieldQuote(provider, env, nowMs), timeoutMs),
  ])
  const input: SusdrRiskInput = {
    pausedExternalAssetCount: results.reduce(
      (total, result) => total + (result.outcome.pausedExternalAssetCount ?? 0),
      0
    ),
    sourceApyByAssetId: results.reduce<Record<string, SusdrYieldQuote>>((quotes, result) => {
      quotes[result.assetId] = result.outcome.quote
      return quotes
    }, {}),
    sourceApyFallbackAssetIds: results.filter((result) => result.fallback).map((result) => result.assetId),
  }

  cachedYieldRiskInput = { fetchedAtMs: nowMs, input, key }

  return input
}
