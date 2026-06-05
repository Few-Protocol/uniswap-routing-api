import { describe, expect, it } from '@jest/globals'
import { formatRawAmount, scaleRawAmount } from '../../../../lib/susdr'

describe('sUSDR amount helpers', () => {
  it('scales 6 decimal USDC raw amounts to 18 decimals', () => {
    expect(scaleRawAmount('1250000', 6, 18).toString()).toEqual('1250000000000000000')
  })

  it('formats raw 18 decimal amounts without trailing zero noise', () => {
    expect(formatRawAmount('1250000000000000000', 18)).toEqual('1.25')
    expect(formatRawAmount('1000000000000000000', 18)).toEqual('1')
  })
})
