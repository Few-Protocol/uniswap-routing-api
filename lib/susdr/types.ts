export const SUSDR_INTERNAL_DECIMALS = 18
export const BPS_DENOMINATOR = 10_000

export type SusdrRiskLevel = 'ok' | 'watch' | 'pause_deposits'

export type SusdrLiquiditySourceKind = 'idle-usdr' | 'idle-usdc' | 'aave-usdc' | 'sor-wrapper'
export type SusdrLiquiditySourceReadType = 'erc20-balance' | 'aave-max-withdraw'

export type SusdrLiquiditySource = {
  id: string
  kind: SusdrLiquiditySourceKind
  label: string
  amountRaw: string
  decimals: number
  enabled?: boolean
}

export type SusdrLiquiditySourceConfig = {
  id: string
  kind: SusdrLiquiditySourceKind
  label: string
  readType: SusdrLiquiditySourceReadType
  decimals: number
  tokenAddress?: string
  holderAddress?: string
  aTokenAddress?: string
  ownerAddress?: string
  enabled?: boolean
}

export type SusdrLiquidityReport = {
  chainId: number
  generatedAtMs: number
  sources: SusdrLiquiditySource[]
}

export type SusdrRedemptionSimulationInput = {
  requestedAmountRaw: string
  sources: SusdrLiquiditySource[]
  navBps?: number
  reservedForQueueRaw?: string
  minSafetyBufferRaw?: string
}

export type SusdrRedemptionStep = {
  sourceId: string
  kind: SusdrLiquiditySourceKind
  label: string
  amountRaw: string
  amountDecimal: string
}

export type SusdrRedemptionSimulation = {
  pricingMode: 'nav_pass_through'
  oneToOneGuaranteed: false
  wrapperLossPassThrough: true
  navBps: number
  requestedAmountRaw: string
  requestedAmountDecimal: string
  redeemableAmountRaw: string
  redeemableAmountDecimal: string
  navDiscountRaw: string
  navDiscountDecimal: string
  navPremiumRaw: string
  navPremiumDecimal: string
  instantCapacityRaw: string
  instantCapacityDecimal: string
  instantFillRaw: string
  instantFillDecimal: string
  queueAmountRaw: string
  queueAmountDecimal: string
  reservedForQueueRaw: string
  minSafetyBufferRaw: string
  steps: SusdrRedemptionStep[]
}

export type SusdrRiskSignal = {
  id: string
  level: SusdrRiskLevel
  message: string
  value?: string
  threshold?: string
}

export type SusdrRiskThresholds = {
  minUsdrPriceBps: number
  maxUsdrPriceBps: number
  maxSupplyIncreaseBps24h: number
  maxSourceStaleSeconds: number
  minApxUsdPriceBps: number
  maxApyUsdNavDiscountBps: number
  maxApyUsdQueueDays: number
  apyUsdRecoveryStableDays: number
}

export type SusdrRiskInput = {
  requestedAmountRaw?: string
  instantCapacityRaw?: string
  usdrPriceBps?: number
  usdrSupplyIncreaseBps24h?: number
  oldestSourceAgeSeconds?: number
  apxUsdPriceBps?: number
  apyUsdNavDiscountBps?: number
  apyUsdQueueDays?: number
  apyUsdPriceDataAgeSeconds?: number
  apyUsdRecoveryStableDays?: number
  marketPriceUnavailable?: boolean
  coreRoleChangeDetected?: boolean
  pausedExternalAssetCount?: number
}

export type SusdrReserveAssetStatus = 'active' | 'paused' | 'watch'

export type SusdrReserveAsset = {
  id: string
  label: string
  targetWeightBps: number
  maxWeightBps: number
  sourceApyBps: number
  status: SusdrReserveAssetStatus
  reason: string
  priceBps?: number
  thresholdBps?: number
  navDiscountBps?: number
  queueDays?: number
}

export type SusdrReservePolicy = {
  mode: 'safe_launch' | 'apyusd_gray_candidate'
  summary: string
  targetApyBps: number
  reserveYieldBps: number
  subsidyApyBps: number
  tvlCapUsd: number
  assets: SusdrReserveAsset[]
  recoveryRules: {
    minApxUsdPriceBps: number
    maxApyUsdNavDiscountBps: number
    stableDaysRequired: number
  }
}

export type SusdrRiskReport = {
  level: SusdrRiskLevel
  signals: SusdrRiskSignal[]
  thresholds: SusdrRiskThresholds
  reservePolicy: SusdrReservePolicy
}

export type SusdrReadinessStatus = 'ready' | 'missing'

export type SusdrReadinessCheck = {
  id: string
  label: string
  status: SusdrReadinessStatus
  detail: string
  requiredForStrict: boolean
}

export type SusdrReadinessReport = {
  chainId: number
  generatedAtMs: number
  liveConfigReady: boolean
  strictReady: boolean
  counts: {
    liquiditySourceConfigs: number
    v2PoolConfigs: number
  }
  missing: string[]
  checks: SusdrReadinessCheck[]
}

export type SusdrTokenRef = {
  address: string
  symbol: string
  decimals: number
}

export type SusdrV2PoolCapacityMode = 'team-lp' | 'full-reserve'

export type SusdrV2PoolConfig = {
  poolAddress: string
  label: string
  capacityMode: SusdrV2PoolCapacityMode
  teamAddresses?: string[]
  usableTeamLpBps?: number
  maxSlippageBps?: number
}

export type SusdrV2PoolSnapshot = {
  poolAddress: string
  label: string
  capacityMode: SusdrV2PoolCapacityMode
  token0: string
  token1: string
  token0Symbol: string
  token1Symbol: string
  token0Decimals: number
  token1Decimals: number
  reserve0Raw: string
  reserve1Raw: string
  reserve0Decimal: string
  reserve1Decimal: string
  totalSupplyRaw: string
  teamLpRaw: string
  teamLpShareBps: number
  usableTeamLpBps: number
  maxSlippageBps: number
  usableInput0Raw: string
  usableInput1Raw: string
  usableReserve0Raw: string
  usableReserve1Raw: string
  usableInput0Decimal: string
  usableInput1Decimal: string
  usableReserve0Decimal: string
  usableReserve1Decimal: string
  blockNumber: number
}

export type SusdrV2PoolsReport = {
  chainId: number
  generatedAtMs: number
  pools: SusdrV2PoolSnapshot[]
}
