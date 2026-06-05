import axios from 'axios'
import { SusdrRiskInput } from './types'

export const DEFAULT_SUSDR_MARKET_DATA_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=apxusd,apyusd&vs_currencies=usd&include_last_updated_at=true'

type CoinGeckoSimplePrice = {
  apxusd?: {
    usd?: number
    last_updated_at?: number
  }
  apyusd?: {
    usd?: number
    last_updated_at?: number
  }
}

type CachedMarketRiskInput = {
  input: SusdrRiskInput
  fetchedAtMs: number
  url: string
}

let cachedMarketRiskInput: CachedMarketRiskInput | undefined

function priceToBps(price: number | undefined): number | undefined {
  return typeof price === 'number' && Number.isFinite(price) ? Math.round(price * 10_000) : undefined
}

function updatedAtToAgeSeconds(updatedAtSeconds: number | undefined, nowMs: number): number | undefined {
  if (typeof updatedAtSeconds !== 'number' || !Number.isFinite(updatedAtSeconds)) {
    return undefined
  }

  return Math.max(0, Math.floor(nowMs / 1000 - updatedAtSeconds))
}

function maxKnownAgeSeconds(...ages: Array<number | undefined>): number | undefined {
  const knownAges = ages.filter((age): age is number => age !== undefined)
  return knownAges.length > 0 ? Math.max(...knownAges) : undefined
}

function cacheTtlMs(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const parsed = Number(env[key] ?? fallback)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function readCachedMarketRiskInput(nowMs: number, url: string, maxAgeMs: number): SusdrRiskInput | undefined {
  if (
    !cachedMarketRiskInput ||
    cachedMarketRiskInput.url !== url ||
    nowMs - cachedMarketRiskInput.fetchedAtMs > maxAgeMs
  ) {
    return undefined
  }

  const elapsedSeconds = Math.max(0, Math.floor((nowMs - cachedMarketRiskInput.fetchedAtMs) / 1000))
  return {
    ...cachedMarketRiskInput.input,
    apyUsdPriceDataAgeSeconds:
      cachedMarketRiskInput.input.apyUsdPriceDataAgeSeconds === undefined
        ? undefined
        : cachedMarketRiskInput.input.apyUsdPriceDataAgeSeconds + elapsedSeconds,
  }
}

export function clearSusdrMarketDataCacheForTest(): void {
  cachedMarketRiskInput = undefined
}

export async function readSusdrMarketRiskInput(
  env: NodeJS.ProcessEnv = process.env,
  nowMs: number = Date.now()
): Promise<SusdrRiskInput> {
  if (env.SUSDR_DISABLE_MARKET_DATA === 'true') {
    return {}
  }

  const url = env.SUSDR_MARKET_DATA_URL ?? DEFAULT_SUSDR_MARKET_DATA_URL
  const freshCache = readCachedMarketRiskInput(nowMs, url, cacheTtlMs(env, 'SUSDR_MARKET_DATA_CACHE_TTL_MS', 30_000))
  if (freshCache) {
    return freshCache
  }

  try {
    const { data } = await axios.get<CoinGeckoSimplePrice>(url, {
      timeout: Number(env.SUSDR_MARKET_DATA_TIMEOUT_MS ?? 5000),
    })

    const apxUsdPriceBps = priceToBps(data.apxusd?.usd)
    const apxUsdAgeSeconds = updatedAtToAgeSeconds(data.apxusd?.last_updated_at, nowMs)
    const apyUsdAgeSeconds = updatedAtToAgeSeconds(data.apyusd?.last_updated_at, nowMs)

    if (apxUsdPriceBps === undefined) {
      return {
        marketPriceUnavailable: true,
      }
    }

    const input = {
      apxUsdPriceBps,
      apyUsdPriceDataAgeSeconds: maxKnownAgeSeconds(apxUsdAgeSeconds, apyUsdAgeSeconds),
    }
    cachedMarketRiskInput = { fetchedAtMs: nowMs, input, url }

    return input
  } catch {
    const staleCache = readCachedMarketRiskInput(
      nowMs,
      url,
      cacheTtlMs(env, 'SUSDR_MARKET_DATA_STALE_CACHE_TTL_MS', 600_000)
    )
    if (staleCache) {
      return staleCache
    }

    return {
      marketPriceUnavailable: true,
    }
  }
}
