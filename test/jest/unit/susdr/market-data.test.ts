import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import axios from 'axios'
import { clearSusdrMarketDataCacheForTest, readSusdrMarketRiskInput } from '../../../../lib/susdr'

const mockedGet = jest.fn<(url: string, config: { timeout: number }) => Promise<{ data: unknown }>>()
const originalGet = axios.get

describe('readSusdrMarketRiskInput', () => {
  beforeEach(() => {
    mockedGet.mockReset()
    clearSusdrMarketDataCacheForTest()
    ;(axios as unknown as { get: typeof mockedGet }).get = mockedGet
  })

  afterEach(() => {
    ;(axios as unknown as { get: typeof originalGet }).get = originalGet
  })

  it('reads apxUSD price from the configured market data URL', async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        apxusd: { usd: 0.9493, last_updated_at: 1_000 },
        apyusd: { usd: 1.2, last_updated_at: 995 },
      },
    })

    const result = await readSusdrMarketRiskInput({ SUSDR_MARKET_DATA_URL: 'https://prices.example' }, 1_100_000)

    expect(mockedGet).toHaveBeenCalledWith('https://prices.example', { timeout: 5000 })
    expect(result).toEqual({ apxUsdPriceBps: 9_493, apyUsdPriceDataAgeSeconds: 105 })
  })

  it('does not mark prices fresh when the provider omits timestamps', async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        apxusd: { usd: 0.9493 },
      },
    })

    const result = await readSusdrMarketRiskInput({ SUSDR_MARKET_DATA_URL: 'https://prices.example' }, 1_100_000)

    expect(result).toEqual({ apxUsdPriceBps: 9_493, apyUsdPriceDataAgeSeconds: undefined })
  })

  it('returns unavailable when the provider omits apxUSD price', async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        apyusd: { usd: 1.2, last_updated_at: 995 },
      },
    })

    await expect(readSusdrMarketRiskInput({ SUSDR_MARKET_DATA_URL: 'https://prices.example' })).resolves.toEqual({
      marketPriceUnavailable: true,
    })
  })

  it('returns a watch signal input when price fetch fails', async () => {
    mockedGet.mockRejectedValueOnce(new Error('network'))

    await expect(readSusdrMarketRiskInput()).resolves.toEqual({ marketPriceUnavailable: true })
  })

  it('caches a successful price for repeated reads', async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        apxusd: { usd: 0.9493, last_updated_at: 1_000 },
      },
    })

    await expect(
      readSusdrMarketRiskInput({ SUSDR_MARKET_DATA_URL: 'https://prices.example' }, 1_100_000)
    ).resolves.toEqual({
      apxUsdPriceBps: 9_493,
      apyUsdPriceDataAgeSeconds: 100,
    })
    await expect(
      readSusdrMarketRiskInput({ SUSDR_MARKET_DATA_URL: 'https://prices.example' }, 1_105_000)
    ).resolves.toEqual({
      apxUsdPriceBps: 9_493,
      apyUsdPriceDataAgeSeconds: 105,
    })
    expect(mockedGet).toHaveBeenCalledTimes(1)
  })

  it('falls back to recent cached price when a refresh fails', async () => {
    mockedGet
      .mockResolvedValueOnce({
        data: {
          apxusd: { usd: 0.9493, last_updated_at: 1_000 },
        },
      })
      .mockRejectedValueOnce(new Error('network'))

    await readSusdrMarketRiskInput(
      {
        SUSDR_MARKET_DATA_CACHE_TTL_MS: '0',
        SUSDR_MARKET_DATA_URL: 'https://prices.example',
      },
      1_100_000
    )
    await expect(
      readSusdrMarketRiskInput(
        {
          SUSDR_MARKET_DATA_CACHE_TTL_MS: '0',
          SUSDR_MARKET_DATA_URL: 'https://prices.example',
        },
        1_130_000
      )
    ).resolves.toEqual({
      apxUsdPriceBps: 9_493,
      apyUsdPriceDataAgeSeconds: 130,
    })
  })
})
