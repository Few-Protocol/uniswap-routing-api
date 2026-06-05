const DEFAULT_BASE_URL = 'http://127.0.0.1:4000'
const ONE_THOUSAND_18 = '1000000000000000000000'

const baseUrl = (process.env.SUSDR_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '')
const requireLiveConfig = process.argv.includes('--require-live-config')

function url(path, params = {}) {
  const target = new URL(path, baseUrl)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      target.searchParams.set(key, String(value))
    }
  })
  return target
}

async function getJson(path, params) {
  const response = await fetch(url(path, params))
  const text = await response.text()
  let body
  try {
    body = text ? JSON.parse(text) : {}
  } catch {
    body = { raw: text }
  }

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}: ${JSON.stringify(body)}`)
  }

  return body
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`)
  }
}

function assertTruthy(value, label) {
  if (!value) {
    throw new Error(`${label}: missing`)
  }
}

function assertNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label}: expected finite number, got ${value}`)
  }
}

async function main() {
  const [readiness, status, liquidity, pools, navSim, liveSim] = await Promise.all([
    getJson('/susdr/readiness', { chainId: 1 }),
    getJson('/susdr/status', { chainId: 1 }),
    getJson('/susdr/liquidity', { chainId: 1 }),
    getJson('/susdr/v2-pools', { chainId: 1 }),
    getJson('/susdr/redeem-sim', {
      amountRaw: ONE_THOUSAND_18,
      idleUsdrRaw: ONE_THOUSAND_18,
      navBps: 9400,
      useConfiguredSources: false,
    }),
    getJson('/susdr/redeem-sim', {
      amountRaw: ONE_THOUSAND_18,
      navBps: 10000,
      useConfiguredSources: true,
    }),
  ])

  assertTruthy(status.reservePolicy, 'reservePolicy')
  const sourceApyByAsset = Object.fromEntries(
    status.reservePolicy.assets.map((asset) => {
      assertNumber(asset.sourceApyBps, `${asset.id}.sourceApyBps`)
      return [asset.id, `${(asset.sourceApyBps / 100).toFixed(2)}%`]
    })
  )
  assertEqual(navSim.pricingMode, 'nav_pass_through', 'pricingMode')
  assertEqual(navSim.oneToOneGuaranteed, false, 'oneToOneGuaranteed')
  assertEqual(navSim.wrapperLossPassThrough, true, 'wrapperLossPassThrough')
  assertEqual(navSim.redeemableAmountDecimal, '940', 'NAV 94% redeemable amount')
  assertEqual(navSim.navDiscountDecimal, '60', 'NAV 94% discount')
  assertEqual(navSim.instantFillDecimal, '940', 'NAV 94% instant fill')

  const summary = {
    api: baseUrl,
    riskLevel: status.level,
    signals: status.signals?.map((signal) => signal.id) ?? [],
    reserveMode: status.reservePolicy.mode,
    policyApy: `${(status.reservePolicy.targetApyBps / 100).toFixed(2)}%`,
    reserveYield: `${(status.reservePolicy.reserveYieldBps / 100).toFixed(2)}%`,
    subsidyApy: `${(status.reservePolicy.subsidyApyBps / 100).toFixed(2)}%`,
    sourceApyByAsset,
    strictReady: readiness.strictReady,
    sourceCount: liquidity.sources?.length ?? 0,
    poolCount: pools.pools?.length ?? 0,
    liveInstantFill: `${liveSim.instantFillDecimal} USDR`,
    liveQueue: `${liveSim.queueAmountDecimal} USDR`,
    navPassThroughCheck: '1000 sUSDR at 94% NAV -> 940 USDR claim',
  }

  const missing = readiness.missing ?? []

  console.log(JSON.stringify({ summary, missing, readiness: readiness.checks }, null, 2))

  if (requireLiveConfig && missing.length > 0) {
    throw new Error(`Live config missing: ${missing.join('; ')}`)
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
