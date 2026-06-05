import { BigNumber } from '@ethersproject/bignumber'
import { formatRawAmount, maxBigNumber, minBigNumber, scaleRawAmount } from './amount'
import {
  BPS_DENOMINATOR,
  SUSDR_INTERNAL_DECIMALS,
  SusdrLiquiditySource,
  SusdrRedemptionSimulation,
  SusdrRedemptionSimulationInput,
  SusdrRedemptionStep,
} from './types'

function normalizedAmount(source: SusdrLiquiditySource): BigNumber {
  return scaleRawAmount(source.amountRaw, source.decimals, SUSDR_INTERNAL_DECIMALS)
}

function toStep(source: SusdrLiquiditySource, amount: BigNumber): SusdrRedemptionStep {
  return {
    sourceId: source.id,
    kind: source.kind,
    label: source.label,
    amountRaw: amount.toString(),
    amountDecimal: formatRawAmount(amount, SUSDR_INTERNAL_DECIMALS),
  }
}

export function simulateInstantRedemption(input: SusdrRedemptionSimulationInput): SusdrRedemptionSimulation {
  const requestedAmount = BigNumber.from(input.requestedAmountRaw)
  const navBps = input.navBps ?? BPS_DENOMINATOR
  const redeemableAmount = requestedAmount.mul(navBps).div(BPS_DENOMINATOR)
  const navDiscount = requestedAmount.gt(redeemableAmount) ? requestedAmount.sub(redeemableAmount) : BigNumber.from(0)
  const navPremium = redeemableAmount.gt(requestedAmount) ? redeemableAmount.sub(requestedAmount) : BigNumber.from(0)
  const reservedForQueue = BigNumber.from(input.reservedForQueueRaw ?? 0)
  const minSafetyBuffer = BigNumber.from(input.minSafetyBufferRaw ?? 0)
  const enabledSources = input.sources.filter((source) => source.enabled !== false)

  const totalLiquidity = enabledSources.reduce(
    (total, source) => total.add(normalizedAmount(source)),
    BigNumber.from(0)
  )
  const reservedLiquidity = reservedForQueue.add(minSafetyBuffer)
  const instantCapacity = maxBigNumber(
    totalLiquidity.sub(minBigNumber(totalLiquidity, reservedLiquidity)),
    BigNumber.from(0)
  )
  const instantFill = minBigNumber(redeemableAmount, instantCapacity)
  let remainingFill = instantFill

  const steps: SusdrRedemptionStep[] = []
  for (const source of enabledSources) {
    if (remainingFill.isZero()) {
      break
    }

    const sourceAmount = normalizedAmount(source)
    const stepAmount = minBigNumber(sourceAmount, remainingFill)
    if (!stepAmount.isZero()) {
      steps.push(toStep(source, stepAmount))
      remainingFill = remainingFill.sub(stepAmount)
    }
  }

  const queueAmount = redeemableAmount.sub(instantFill)

  return {
    pricingMode: 'nav_pass_through',
    oneToOneGuaranteed: false,
    wrapperLossPassThrough: true,
    navBps,
    requestedAmountRaw: requestedAmount.toString(),
    requestedAmountDecimal: formatRawAmount(requestedAmount, SUSDR_INTERNAL_DECIMALS),
    redeemableAmountRaw: redeemableAmount.toString(),
    redeemableAmountDecimal: formatRawAmount(redeemableAmount, SUSDR_INTERNAL_DECIMALS),
    navDiscountRaw: navDiscount.toString(),
    navDiscountDecimal: formatRawAmount(navDiscount, SUSDR_INTERNAL_DECIMALS),
    navPremiumRaw: navPremium.toString(),
    navPremiumDecimal: formatRawAmount(navPremium, SUSDR_INTERNAL_DECIMALS),
    instantCapacityRaw: instantCapacity.toString(),
    instantCapacityDecimal: formatRawAmount(instantCapacity, SUSDR_INTERNAL_DECIMALS),
    instantFillRaw: instantFill.toString(),
    instantFillDecimal: formatRawAmount(instantFill, SUSDR_INTERNAL_DECIMALS),
    queueAmountRaw: queueAmount.toString(),
    queueAmountDecimal: formatRawAmount(queueAmount, SUSDR_INTERNAL_DECIMALS),
    reservedForQueueRaw: reservedForQueue.toString(),
    minSafetyBufferRaw: minSafetyBuffer.toString(),
    steps,
  }
}
