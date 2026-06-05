import { BigNumber } from '@ethersproject/bignumber'

const POWERS_OF_TEN: Record<number, BigNumber> = {}

export function pow10(decimals: number): BigNumber {
  if (decimals < 0 || !Number.isInteger(decimals)) {
    throw new Error(`Invalid decimals: ${decimals}`)
  }

  if (!POWERS_OF_TEN[decimals]) {
    POWERS_OF_TEN[decimals] = BigNumber.from(10).pow(decimals)
  }

  return POWERS_OF_TEN[decimals]
}

export function scaleRawAmount(amountRaw: string | BigNumber, fromDecimals: number, toDecimals: number): BigNumber {
  const amount = BigNumber.from(amountRaw)
  if (fromDecimals === toDecimals) {
    return amount
  }

  if (fromDecimals < toDecimals) {
    return amount.mul(pow10(toDecimals - fromDecimals))
  }

  return amount.div(pow10(fromDecimals - toDecimals))
}

export function formatRawAmount(amountRaw: string | BigNumber, decimals: number): string {
  const amount = BigNumber.from(amountRaw)
  const base = pow10(decimals)
  const whole = amount.div(base).toString()
  const fraction = amount.mod(base).toString().padStart(decimals, '0').replace(/0+$/, '')

  return fraction.length > 0 ? `${whole}.${fraction}` : whole
}

export function minBigNumber(a: BigNumber, b: BigNumber): BigNumber {
  return a.lte(b) ? a : b
}

export function maxBigNumber(a: BigNumber, b: BigNumber): BigNumber {
  return a.gte(b) ? a : b
}
