import { Protocol } from '@ring-protocol/router-sdk'
import { ChainId } from '@ring-protocol/sdk-core'

export const S3_POOL_CACHE_KEY = (baseKey: string, chain: ChainId, protocol: Protocol) =>
  `${baseKey}-${chain}-${protocol}`
