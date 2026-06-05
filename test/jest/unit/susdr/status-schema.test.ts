import { describe, expect, it } from '@jest/globals'
import { SusdrReadinessReportSchemaJoi, SusdrStatusQueryParamsJoi } from '../../../../lib/handlers/susdr/schema'

describe('SusdrStatusQueryParamsJoi', () => {
  it('does not inject default risk override values into empty queries', () => {
    const result = SusdrStatusQueryParamsJoi.validate({})

    expect(result.error).toBeUndefined()
    expect(result.value).toEqual({})
  })
})

describe('SusdrReadinessReportSchemaJoi', () => {
  it('validates config readiness reports', () => {
    const result = SusdrReadinessReportSchemaJoi.validate({
      chainId: 1,
      generatedAtMs: 1_780_000_000_000,
      liveConfigReady: false,
      strictReady: false,
      counts: {
        liquiditySourceConfigs: 0,
        v2PoolConfigs: 0,
      },
      missing: ['Missing SUSDR_LIQUIDITY_SOURCES_JSON: vault / holder / Aave owner addresses'],
      checks: [
        {
          id: 'liquidity-sources',
          label: 'Liquidity sources',
          status: 'missing',
          detail: 'Missing SUSDR_LIQUIDITY_SOURCES_JSON: vault / holder / Aave owner addresses',
          requiredForStrict: true,
        },
      ],
    })

    expect(result.error).toBeUndefined()
  })
})
