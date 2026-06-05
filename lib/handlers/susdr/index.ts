import { default as bunyan, default as Logger } from 'bunyan'
import { SusdrHandlerInjector } from './injector'
import { SusdrLiquidityHandler } from './liquidity'
import { SusdrReadinessHandler } from './readiness'
import { SusdrRedeemSimHandler } from './redeem-sim'
import {
  SusdrLiquidityQueryParams,
  SusdrReadinessQueryParams,
  SusdrRedeemSimQueryParams,
  SusdrStatusQueryParams,
  SusdrV2PoolsQueryParams,
} from './schema'
import { SusdrStatusHandler } from './status'
import { SusdrV2PoolsHandler } from './v2-pools'

const log: Logger = bunyan.createLogger({
  name: 'SusdrRoot',
  serializers: bunyan.stdSerializers,
  level: bunyan.INFO,
})

let susdrStatusHandler: SusdrStatusHandler
let susdrRedeemSimHandler: SusdrRedeemSimHandler
let susdrV2PoolsHandler: SusdrV2PoolsHandler
let susdrLiquidityHandler: SusdrLiquidityHandler
let susdrReadinessHandler: SusdrReadinessHandler

try {
  const susdrStatusInjectorPromise = new SusdrHandlerInjector<SusdrStatusQueryParams>('susdrStatusInjector').build()
  susdrStatusHandler = new SusdrStatusHandler('susdr-status', susdrStatusInjectorPromise)

  const susdrRedeemSimInjectorPromise = new SusdrHandlerInjector<SusdrRedeemSimQueryParams>(
    'susdrRedeemSimInjector'
  ).build()
  susdrRedeemSimHandler = new SusdrRedeemSimHandler('susdr-redeem-sim', susdrRedeemSimInjectorPromise)

  const susdrV2PoolsInjectorPromise = new SusdrHandlerInjector<SusdrV2PoolsQueryParams>('susdrV2PoolsInjector').build()
  susdrV2PoolsHandler = new SusdrV2PoolsHandler('susdr-v2-pools', susdrV2PoolsInjectorPromise)

  const susdrLiquidityInjectorPromise = new SusdrHandlerInjector<SusdrLiquidityQueryParams>(
    'susdrLiquidityInjector'
  ).build()
  susdrLiquidityHandler = new SusdrLiquidityHandler('susdr-liquidity', susdrLiquidityInjectorPromise)

  const susdrReadinessInjectorPromise = new SusdrHandlerInjector<SusdrReadinessQueryParams>(
    'susdrReadinessInjector'
  ).build()
  susdrReadinessHandler = new SusdrReadinessHandler('susdr-readiness', susdrReadinessInjectorPromise)
} catch (error) {
  log.fatal({ error }, 'Fatal error')
  throw error
}

module.exports = {
  susdrStatusHandler: susdrStatusHandler.handler,
  susdrRedeemSimHandler: susdrRedeemSimHandler.handler,
  susdrV2PoolsHandler: susdrV2PoolsHandler.handler,
  susdrLiquidityHandler: susdrLiquidityHandler.handler,
  susdrReadinessHandler: susdrReadinessHandler.handler,
}
