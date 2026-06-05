import { StaticJsonRpcProvider } from '@ethersproject/providers'
import {
  BPS_DENOMINATOR,
  SusdrLiquiditySourceConfig,
  SusdrLiquiditySourceKind,
  SusdrLiquiditySourceReadType,
  SusdrReadinessCheck,
  SusdrReadinessReport,
  SusdrV2PoolConfig,
  SusdrV2PoolCapacityMode,
} from './types'

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/
const LIQUIDITY_SOURCE_KINDS = new Set<SusdrLiquiditySourceKind>(['idle-usdr', 'idle-usdc', 'aave-usdc', 'sor-wrapper'])
const LIQUIDITY_SOURCE_READ_TYPES = new Set<SusdrLiquiditySourceReadType>(['erc20-balance', 'aave-max-withdraw'])
const V2_POOL_CAPACITY_MODES = new Set<SusdrV2PoolCapacityMode>(['team-lp', 'full-reserve'])
const DEFAULT_FULL_RESERVE_MAX_SLIPPAGE_BPS = 50

function isAddressLike(value: unknown): value is string {
  return typeof value === 'string' && ADDRESS_PATTERN.test(value)
}

function parseTeamAddresses(value: unknown, index: number): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((address) => !isAddressLike(address))) {
    throw new Error(`Invalid teamAddresses for sUSDR V2 pool config at index ${index}`)
  }

  return value
}

function parseUsableTeamLpBps(value: unknown, index: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 10_000) {
    throw new Error(`Invalid usableTeamLpBps for sUSDR V2 pool config at index ${index}`)
  }

  return value
}

function parseCapacityMode(value: unknown, index: number): SusdrV2PoolCapacityMode {
  if (value === undefined) {
    return 'team-lp'
  }

  if (typeof value !== 'string' || !V2_POOL_CAPACITY_MODES.has(value as SusdrV2PoolCapacityMode)) {
    throw new Error(`Invalid capacityMode for sUSDR V2 pool config at index ${index}`)
  }

  return value as SusdrV2PoolCapacityMode
}

function parseMaxSlippageBps(value: unknown, index: number): number {
  if (value === undefined) {
    return DEFAULT_FULL_RESERVE_MAX_SLIPPAGE_BPS
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > BPS_DENOMINATOR) {
    throw new Error(`Invalid maxSlippageBps for sUSDR V2 pool config at index ${index}`)
  }

  return value
}

function parseNonEmptyString(value: unknown, field: string, index: number): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid ${field} for sUSDR config at index ${index}`)
  }

  return value
}

function parseDecimals(value: unknown, index: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 36) {
    throw new Error(`Invalid decimals for sUSDR liquidity source config at index ${index}`)
  }

  return value
}

function parseEnabled(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function parseLiquiditySourceKind(value: unknown, index: number): SusdrLiquiditySourceKind {
  if (typeof value !== 'string' || !LIQUIDITY_SOURCE_KINDS.has(value as SusdrLiquiditySourceKind)) {
    throw new Error(`Invalid kind for sUSDR liquidity source config at index ${index}`)
  }

  return value as SusdrLiquiditySourceKind
}

function parseLiquiditySourceReadType(value: unknown, index: number): SusdrLiquiditySourceReadType {
  if (typeof value !== 'string' || !LIQUIDITY_SOURCE_READ_TYPES.has(value as SusdrLiquiditySourceReadType)) {
    throw new Error(`Invalid readType for sUSDR liquidity source config at index ${index}`)
  }

  return value as SusdrLiquiditySourceReadType
}

function parseAddress(value: unknown, field: string, index: number): string {
  if (!isAddressLike(value)) {
    throw new Error(`Invalid ${field} for sUSDR liquidity source config at index ${index}`)
  }

  return value
}

export function parseSusdrV2PoolConfigs(rawConfig: string | undefined): SusdrV2PoolConfig[] {
  if (!rawConfig || rawConfig.trim() === '' || rawConfig.trim() === 'undefined') {
    return []
  }

  const parsed = JSON.parse(rawConfig)
  if (!Array.isArray(parsed)) {
    throw new Error('SUSDR_V2_POOLS_JSON must be a JSON array')
  }

  return parsed.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Invalid sUSDR V2 pool config at index ${index}`)
    }

    const rawItem = item as Record<string, unknown>
    if (!isAddressLike(rawItem.poolAddress)) {
      throw new Error(`Invalid poolAddress for sUSDR V2 pool config at index ${index}`)
    }

    const capacityMode = parseCapacityMode(rawItem.capacityMode, index)
    if (capacityMode === 'full-reserve') {
      return {
        poolAddress: rawItem.poolAddress,
        label: typeof rawItem.label === 'string' && rawItem.label.length > 0 ? rawItem.label : rawItem.poolAddress,
        capacityMode,
        teamAddresses: [],
        usableTeamLpBps: BPS_DENOMINATOR,
        maxSlippageBps: parseMaxSlippageBps(rawItem.maxSlippageBps, index),
      }
    }

    return {
      poolAddress: rawItem.poolAddress,
      label: typeof rawItem.label === 'string' && rawItem.label.length > 0 ? rawItem.label : rawItem.poolAddress,
      capacityMode,
      teamAddresses: parseTeamAddresses(rawItem.teamAddresses, index),
      usableTeamLpBps: parseUsableTeamLpBps(rawItem.usableTeamLpBps, index),
      maxSlippageBps: parseMaxSlippageBps(rawItem.maxSlippageBps, index),
    }
  })
}

export function parseSusdrLiquiditySourceConfigs(rawConfig: string | undefined): SusdrLiquiditySourceConfig[] {
  if (!rawConfig || rawConfig.trim() === '' || rawConfig.trim() === 'undefined') {
    return []
  }

  const parsed = JSON.parse(rawConfig)
  if (!Array.isArray(parsed)) {
    throw new Error('SUSDR_LIQUIDITY_SOURCES_JSON must be a JSON array')
  }

  return parsed.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Invalid sUSDR liquidity source config at index ${index}`)
    }

    const rawItem = item as Record<string, unknown>
    const readType = parseLiquiditySourceReadType(rawItem.readType, index)
    const config: SusdrLiquiditySourceConfig = {
      id: parseNonEmptyString(rawItem.id, 'id', index),
      kind: parseLiquiditySourceKind(rawItem.kind, index),
      label: parseNonEmptyString(rawItem.label, 'label', index),
      readType,
      decimals: parseDecimals(rawItem.decimals, index),
      enabled: parseEnabled(rawItem.enabled),
    }

    if (readType === 'erc20-balance') {
      config.tokenAddress = parseAddress(rawItem.tokenAddress, 'tokenAddress', index)
      config.holderAddress = parseAddress(rawItem.holderAddress, 'holderAddress', index)
      return config
    }

    config.tokenAddress = parseAddress(rawItem.tokenAddress, 'tokenAddress', index)
    config.aTokenAddress = parseAddress(rawItem.aTokenAddress, 'aTokenAddress', index)
    config.ownerAddress = parseAddress(rawItem.ownerAddress, 'ownerAddress', index)
    return config
  })
}

export function getSusdrRpcUrl(chainId: number, env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env[`SUSDR_RPC_URL_${chainId}`] ?? env[`WEB3_RPC_${chainId}`] ?? env.SUSDR_RPC_URL
}

export function buildSusdrReadOnlyProvider(
  chainId: number,
  env: NodeJS.ProcessEnv = process.env
): StaticJsonRpcProvider {
  const rpcUrl = getSusdrRpcUrl(chainId, env)
  if (!rpcUrl) {
    throw new Error(`Missing read-only RPC URL for chain ${chainId}`)
  }

  return new StaticJsonRpcProvider(rpcUrl, chainId)
}

function readinessCheck(
  id: string,
  label: string,
  ready: boolean,
  readyDetail: string,
  missingDetail: string,
  requiredForStrict = true
): SusdrReadinessCheck {
  return {
    id,
    label,
    status: ready ? 'ready' : 'missing',
    detail: ready ? readyDetail : missingDetail,
    requiredForStrict,
  }
}

export function buildSusdrReadinessReport({
  chainId,
  env = process.env,
  liquiditySourceConfigs,
  nowMs = Date.now(),
  v2PoolConfigs,
}: {
  chainId: number
  env?: NodeJS.ProcessEnv
  liquiditySourceConfigs: SusdrLiquiditySourceConfig[]
  nowMs?: number
  v2PoolConfigs: SusdrV2PoolConfig[]
}): SusdrReadinessReport {
  const rpcReady = Boolean(getSusdrRpcUrl(chainId, env))
  const liquidityReady = liquiditySourceConfigs.length > 0
  const poolsReady = v2PoolConfigs.length > 0
  const marketDataReady = env.SUSDR_DISABLE_MARKET_DATA !== 'true'
  const checks = [
    readinessCheck(
      'rpc',
      'Read-only RPC',
      rpcReady,
      `RPC configured for chain ${chainId}`,
      `Missing SUSDR_RPC_URL_${chainId}, WEB3_RPC_${chainId}, or SUSDR_RPC_URL`
    ),
    readinessCheck(
      'liquidity-sources',
      'Liquidity sources',
      liquidityReady,
      `${liquiditySourceConfigs.length} liquidity source config(s)`,
      'Missing SUSDR_LIQUIDITY_SOURCES_JSON: vault / holder / Aave owner addresses'
    ),
    readinessCheck(
      'v2-pools',
      'Ring LP pools',
      poolsReady,
      `${v2PoolConfigs.length} V2 pool config(s)`,
      'Missing SUSDR_V2_POOLS_JSON: pool address / capacity mode'
    ),
    readinessCheck(
      'market-data',
      'Market data',
      marketDataReady,
      'Market data enabled',
      'SUSDR_DISABLE_MARKET_DATA=true; status falls back to manual query overrides',
      false
    ),
  ]
  const missing = checks
    .filter((check) => check.status === 'missing' && check.requiredForStrict)
    .map((check) => check.detail)

  return {
    chainId,
    generatedAtMs: nowMs,
    liveConfigReady: liquidityReady && poolsReady,
    strictReady: rpcReady && liquidityReady && poolsReady,
    counts: {
      liquiditySourceConfigs: liquiditySourceConfigs.length,
      v2PoolConfigs: v2PoolConfigs.length,
    },
    missing,
    checks,
  }
}
