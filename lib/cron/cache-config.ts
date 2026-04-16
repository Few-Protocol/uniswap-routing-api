import { Protocol } from '@ring-protocol/router-sdk'
import { V2SubgraphProvider, V3SubgraphProvider, V4SubgraphProvider, RingV2SubgraphProvider } from '@ring-protocol/smart-order-router'
import { ChainId } from '@ring-protocol/sdk-core'
import { EulerSwapHooksSubgraphProvider } from '@ring-protocol/smart-order-router/'
import {
  ZORA_CREATOR_HOOK_ON_BASE_v1,
  ZORA_CREATOR_HOOK_ON_BASE_v1_0_0_1,
  ZORA_CREATOR_HOOK_ON_BASE_v1_1_1,
  ZORA_CREATOR_HOOK_ON_BASE_v1_1_1_1,
  ZORA_CREATOR_HOOK_ON_BASE_v1_1_2,
  ZORA_CREATOR_HOOK_ON_BASE_v2_2,
  ZORA_CREATOR_HOOK_ON_BASE_v2_2_1,
  ZORA_POST_HOOK_ON_BASE_v1,
  ZORA_POST_HOOK_ON_BASE_v1_0_0_1,
  ZORA_POST_HOOK_ON_BASE_v1_0_0_2,
  ZORA_POST_HOOK_ON_BASE_v1_1_1,
  ZORA_POST_HOOK_ON_BASE_v1_1_1_1,
  ZORA_POST_HOOK_ON_BASE_v1_1_2,
  ZORA_POST_HOOK_ON_BASE_v2_2,
  ZORA_POST_HOOK_ON_BASE_v2_2_1,
  ZORA_POST_HOOK_ON_BASE_v2_3_0,
} from '../util/hooksAddressesAllowlist'

// during local cdk stack update, the env vars are not populated
// make sure to fill in the env vars below
// we have two alchemy accounts to split the load, v3 and v4 subgraphs are on
// the second account while v2 is on the first
// process.env.ALCHEMY_QUERY_KEY = ''
// process.env.ALCHEMY_QUERY_KEY_2 = ''
// process.env.GRAPH_BASE_V4_SUBGRAPH_ID = ''
// process.env.GRAPH_BEARER_TOKEN = ''

// Zora hooks addresses for V4 filtering - MUST be lowercase
export const ZORA_HOOKS_FOR_V4_SUBGRAPH_FILTERING = new Set([
  ZORA_CREATOR_HOOK_ON_BASE_v1,
  ZORA_CREATOR_HOOK_ON_BASE_v1_0_0_1,
  ZORA_CREATOR_HOOK_ON_BASE_v1_1_1,
  ZORA_CREATOR_HOOK_ON_BASE_v1_1_1_1,
  ZORA_CREATOR_HOOK_ON_BASE_v1_1_2,
  ZORA_CREATOR_HOOK_ON_BASE_v2_2,
  ZORA_CREATOR_HOOK_ON_BASE_v2_2_1,
  ZORA_POST_HOOK_ON_BASE_v1,
  ZORA_POST_HOOK_ON_BASE_v1_0_0_1,
  ZORA_POST_HOOK_ON_BASE_v1_0_0_2,
  ZORA_POST_HOOK_ON_BASE_v1_1_1,
  ZORA_POST_HOOK_ON_BASE_v1_1_1_1,
  ZORA_POST_HOOK_ON_BASE_v1_1_2,
  ZORA_POST_HOOK_ON_BASE_v2_2,
  ZORA_POST_HOOK_ON_BASE_v2_2_1,
  ZORA_POST_HOOK_ON_BASE_v2_3_0,
])

export const v4SubgraphUrlOverride = (chainId: ChainId) => {
  switch (chainId) {
    case ChainId.SEPOLIA:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v4-sepolia-test/api`
    case ChainId.ARBITRUM_ONE:
      return `https://gateway.thegraph.com/api/subgraphs/id/G5TsTKNi8yhPSV7kycaE23oWbqv9zzNqR49FoEQjzq1r`
    case ChainId.BASE:
      return `https://gateway.thegraph.com/api/subgraphs/id/Gqm2b5J85n1bhCyDMpGbtbVn4935EvvdyHdHrx3dibyj`
    case ChainId.POLYGON:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v4-polygon/api`
    case ChainId.WORLDCHAIN:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v4-worldchain/api`
    case ChainId.ZORA:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v4-zora/api`
    case ChainId.UNICHAIN:
      return `https://gateway.thegraph.com/api/subgraphs/id/aa3YpPCxatg4LaBbLFuv2iBC8Jvs9u3hwt5GTpS4Kit`

    case ChainId.HYPER_MAINNET:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v4-hyper/api`
    case ChainId.BLAST:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v4-blast/api`
    case ChainId.MAINNET:
      return `https://gateway.thegraph.com/api/subgraphs/id/DiYPVdygkfjDWhbxGSqAQxwBKmfKnkWQojqeM2rkLb3G`
    case ChainId.SONEIUM:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v4-soneium-mainnet/api`
    case ChainId.OPTIMISM:
      return `https://gateway.thegraph.com/api/subgraphs/id/6RBtsmGUYfeLeZsYyxyKSUiaA6WpuC69shMEQ1Cfuj9u`

    // goldsky networks
    case ChainId.BNB:
      return `https://api.goldsky.com/api/public/project_cmkz0xpbg9cga012m03ff9uqy/subgraphs/uniswap-v4-bsc/1.0.0/gn`
    // case ChainId.MEGAETH_MAINNET:
    //   return `https://api.goldsky.com/api/public/project_cmkz0xpbg9cga012m03ff9uqy/subgraphs/kumbaya-v4-subgraph-megaeth/1.0.0/gn`
    default:
      return undefined
  }
}

export const v3SubgraphUrlOverride = (chainId: ChainId) => {
  switch (chainId) {
    case ChainId.MAINNET:
      return `https://gateway.thegraph.com/api/subgraphs/id/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV`
    case ChainId.ARBITRUM_ONE:
      return `https://gateway.thegraph.com/api/subgraphs/id/FbCGRftH4a3yZugY7TnbYgPJVEv2LvMT6oF1fxPe9aJM`
    case ChainId.POLYGON:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v3-polygon/api`
    case ChainId.OPTIMISM:
      return `https://gateway.thegraph.com/api/subgraphs/id/Cghf4LfVqPiFw6fp6Y5X5Ubc8UpmUhSfJL82zwiBFLaj`
    case ChainId.AVALANCHE:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v3-avalanche/api`
    case ChainId.HYPER_MAINNET:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v3-hyper/api`
    case ChainId.BLAST:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v3-blast/api`
    case ChainId.BASE:
      return `https://gateway.thegraph.com/api/subgraphs/id/43Hwfi3dJSoGpyas9VwNoDAv55yjgGrPpNSmbQZArzMG`
    case ChainId.CELO:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v3-celo/api`
    case ChainId.WORLDCHAIN:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v3-worldchain/api`
    case ChainId.UNICHAIN_SEPOLIA:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v3-astrochain-sepolia/api`
    case ChainId.UNICHAIN:
      return `https://gateway.thegraph.com/api/subgraphs/id/BCfy6Vw9No3weqVq9NhyGo4FkVCJep1ZN9RMJj5S32fX`
    case ChainId.ZORA:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v3-zora/api`
    case ChainId.SONEIUM:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY_2}/uniswap-2/uniswap-v3-soneium-mainnet/api`
    case ChainId.XLAYER_MAINNET:
      return `https://gateway.thegraph.com/api/subgraphs/id/2LM2nhSfVsKVNW1EF6AgJHMGBKU2zR9rZcE3zzkFkwW1`
    case ChainId.MEGAETH_MAINNET:
      return `https://api.goldsky.com/api/public/project_cmkz0xpbg9cga012m03ff9uqy/subgraphs/kumbaya-v3-subgraph-pool-megaeth/1.0.0/gn`

    // goldsky networks
    case ChainId.BNB:
      return `https://gateway.thegraph.com/api/subgraphs/id/F85MNzUGYqgSHSHRGgeVMNsdnW1KtZSVgFULumXRZTw2`
      default:
      return undefined
  }
}

export const fewV2SubgraphUrlOverride = (chainId: ChainId) => {
  switch (chainId) {
    case ChainId.MAINNET:
      // 使用 The Graph Gateway URL，需要配合 FEWV2_GRAPH_BEARER_TOKEN 环境变量
      return `https://gateway.thegraph.com/api/subgraphs/id/HMtLevwVwkYSSwXXUSmwxr3fiFSzcmyGywA9exPRHfcH`
    case ChainId.SEPOLIA:
      return `https://gateway.thegraph.com/api/subgraphs/id/HMtLevwVwkYSSwXXUSmwxr3fiFSzcmyGywA9exPRHfcH`

    // goldsky networks
    case ChainId.BNB:
      return `https://gateway.thegraph.com/api/subgraphs/id/6jkbFySYhSvJLbQmpcDwUsoMS3Fn6LTBmbeJhHJh7Gyz`
    case ChainId.HYPER_MAINNET:
      return `https://api.goldsky.com/api/public/project_cmkz0xpbg9cga012m03ff9uqy/subgraphs/ringswap-few-v2-subgraph-hyper/1.0.0/gn`
      default:
      return undefined
  }
}

export const v2SubgraphUrlOverride = (chainId: ChainId) => {
  switch (chainId) {
    case ChainId.SEPOLIA:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/uniswap/uniswap-v2-sepolia/api`
    case ChainId.MAINNET:
      return `https://gateway.thegraph.com/api/subgraphs/id/EYCKATKGBKLWvSfwvBjzfCBmGwYNdVkduYXVivCsLRFu`
    case ChainId.ARBITRUM_ONE:
      return `https://gateway.thegraph.com/api/subgraphs/id/CStW6CSQbHoXsgKuVCrk3uShGA4JX3CAzzv2x9zaGf8w`
    case ChainId.POLYGON:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/uniswap/uniswap-v2-polygon/api`
    case ChainId.OPTIMISM:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/uniswap/uniswap-v2-optimism/api`
    case ChainId.AVALANCHE:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/uniswap/uniswap-v2-avalanche/api`
    case ChainId.BLAST:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/uniswap/uniswap-v2-blast/api`
    case ChainId.BASE:
      return `https://gateway.thegraph.com/api/subgraphs/id/D31gzGUtVNhHNdnxeELUBdch5rzDRm5cddvae9GzhCLu`
    case ChainId.WORLDCHAIN:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/uniswap/uniswap-v2-worldchain/api`
    case ChainId.UNICHAIN_SEPOLIA:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/uniswap/uniswap-v2-astrochain-sepolia/api`
    case ChainId.MONAD_TESTNET:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/uniswap/uniswap-v2-monad-testnet/api`
    case ChainId.UNICHAIN:
      return `https://gateway.thegraph.com/api/subgraphs/id/8vvhJXc9Fi2xpc3wXtRpYrWVYfcxThU973HhBukmFh83`
    case ChainId.SONEIUM:
      return `https://subgraph.satsuma-prod.com/${process.env.ALCHEMY_QUERY_KEY}/uniswap/uniswap-v2-soneium-mainnet/api`
    case ChainId.XLAYER_MAINNET:
      return `https://gateway.thegraph.com/api/subgraphs/id/Hz6HejZme4ozdSvnp9oi3UafGRbNVrVVDGow9o6huLQ7`
    case ChainId.BNB:
      return `https://gateway.thegraph.com/api/subgraphs/id/8EjCaWZumyAfN3wyB4QnibeeXaYS8i4sp1PiWT91AGrt`
    case ChainId.HYPER_MAINNET:
      return `https://api.goldsky.com/api/public/project_cmkz0xpbg9cga012m03ff9uqy/subgraphs/uniswap-v2-hyper/1.0.0/gn`
    // case ChainId.MEGAETH_MAINNET:
    //   return `https://api.goldsky.com/api/public/project_cmkz0xpbg9cga012m03ff9uqy/subgraphs/kumbaya-v2-subgraph-megaeth/1.0.0/gn`
    default:
      return undefined
  }
}

const v4TrackedEthThreshold = 0.01 // Pools need at least 0.01 of trackedEth to be selected
// const v4BaseTrackedEthThreshold = 0.1 // Pools on Base need at least 0.1 of trackedEth to be selected
const v4BaseZoraTrackedEthThreshold = 0.001 // Pools on Zora need at least 0.1 of trackedEth to be selected
const v4UntrackedUsdThreshold = 0 // v4 subgraph totalValueLockedUSDUntracked returns 0, even with the pools that have appropriate liqudities and correct pool pricing

export const v3TrackedEthThreshold = 0.01 // Pools need at least 0.01 of trackedEth to be selected
export const v3BaseTrackedEthThreshold = 0.1 // Pools on Base need at least 0.1 of trackedEth to be selected
const v3UntrackedUsdThreshold = 25000 // Pools need at least 25K USD (untracked) to be selected (for metrics only)

export const v2TrackedEthThreshold = 0.025 // Pairs need at least 0.025 of trackedEth to be selected
export const v2BaseTrackedEthThreshold = 0.1 // Pairs on Base need at least 0.1 of trackedEth to be selected
const v2UntrackedUsdThreshold = Number.MAX_VALUE // Pairs need untracked TVL higher than this value to be selected (for metrics only). Currently excludes all V2 pools with untracked TVL.

export interface ChainProtocol {
  protocol: Protocol
  chainId: ChainId
  timeout: number
  provider: V2SubgraphProvider | V3SubgraphProvider | V4SubgraphProvider | RingV2SubgraphProvider
  eulerHooksProvider?: EulerSwapHooksSubgraphProvider
}

export const chainProtocols = [
  // V3.
  {
    protocol: Protocol.V3,
    chainId: ChainId.MAINNET,
    timeout: 90000,
    provider: new V3SubgraphProvider(
      ChainId.MAINNET,
      1,
      90000,
      true,
      v3TrackedEthThreshold,
      v3UntrackedUsdThreshold,
      v3SubgraphUrlOverride(ChainId.MAINNET),
      process.env.GRAPH_BEARER_TOKEN // The Graph Gateway Authorization
    ),
  },
  {
    protocol: Protocol.V3,
    chainId: ChainId.BNB,
    timeout: 90000,
    provider: new V3SubgraphProvider(
      ChainId.BNB,
      3,
      90000,
      true,
      v3TrackedEthThreshold,
      v3UntrackedUsdThreshold,
      v3SubgraphUrlOverride(ChainId.BNB),
      process.env.GOLDSKY_API_KEY || process.env.GRAPH_BEARER_TOKEN_BNB // Goldsky API Key or The Graph Bearer for BNB
    ),
  },
  {
    protocol: Protocol.V3,
    chainId: ChainId.HYPER_MAINNET,
    timeout: 90000,
    provider: new V3SubgraphProvider(
      ChainId.HYPER_MAINNET,
      3,
      90000,
      true,
      v3TrackedEthThreshold,
      v3UntrackedUsdThreshold,
      v3SubgraphUrlOverride(ChainId.HYPER_MAINNET)
      // HYPER V3 uses Satsuma, no bearer token needed
    ),
  },
  {
    protocol: Protocol.V3,
    chainId: ChainId.MEGAETH_MAINNET,
    timeout: 90000,
    provider: new V3SubgraphProvider(
      ChainId.MEGAETH_MAINNET,
      3,
      90000,
      true,
      v3TrackedEthThreshold,
      v3UntrackedUsdThreshold,
      v3SubgraphUrlOverride(ChainId.MEGAETH_MAINNET),
      process.env.GOLDSKY_API_KEY || process.env.GRAPH_BEARER_TOKEN_MEGAETH // Goldsky for MEGAETH
    ),
  },
  {
    protocol: Protocol.V3,
    chainId: ChainId.XLAYER_MAINNET,
    timeout: 90000,
    provider: new V3SubgraphProvider(
      ChainId.XLAYER_MAINNET,
      2,
      90000,
      true,
      v3TrackedEthThreshold,
      v3UntrackedUsdThreshold,
      v3SubgraphUrlOverride(ChainId.XLAYER_MAINNET),
      process.env.GRAPH_BEARER_TOKEN_X_LAYER // The Graph Gateway Authorization
    ),
  },
  /*
  {
    protocol: Protocol.V3,
    chainId: ChainId.ARBITRUM_ONE,
    timeout: 90000,
    provider: new V3SubgraphProvider(
      ChainId.ARBITRUM_ONE,
      5,
      90000,
      true,
      v3TrackedEthThreshold,
      v3UntrackedUsdThreshold,
      v3SubgraphUrlOverride(ChainId.ARBITRUM_ONE)
    ),
  },
  {
    protocol: Protocol.V3,
    chainId: ChainId.POLYGON,
    timeout: 90000,
    provider: new V3SubgraphProvider(
      ChainId.POLYGON,
      3,
      90000,
      true,
      v3TrackedEthThreshold,
      v3UntrackedUsdThreshold,
      v3SubgraphUrlOverride(ChainId.POLYGON)
    ),
  },
  // Waiting for Alchemy subgraph
  {
    protocol: Protocol.V3,
    chainId: ChainId.OPTIMISM,
    timeout: 90000,
    provider: new V3SubgraphProvider(
      ChainId.OPTIMISM,
      3,
      90000,
      true,
      v3TrackedEthThreshold,
      v3UntrackedUsdThreshold,
      v3SubgraphUrlOverride(ChainId.OPTIMISM)
    ),
  },
  {
    protocol: Protocol.V3,
    chainId: ChainId.CELO,
    timeout: 90000,
    provider: new V3SubgraphProvider(
      ChainId.CELO,
      3,
      90000,
      true,
      v3TrackedEthThreshold,
      v3UntrackedUsdThreshold,
      v3SubgraphUrlOverride(ChainId.CELO)
    ),
  },
  {
    protocol: Protocol.V3,
    chainId: ChainId.BNB,
    timeout: 90000,
    provider: new V3SubgraphProvider(
      ChainId.BNB,
      3,
      90000,
      true,
      v3TrackedEthThreshold,
      v3UntrackedUsdThreshold,
      v3SubgraphUrlOverride(ChainId.BNB)
    ),
  },
  {
    protocol: Protocol.V3,
    chainId: ChainId.AVALANCHE,
    timeout: 90000,
    provider: new V3SubgraphProvider(
      ChainId.AVALANCHE,
      3,
      90000,
      true,
      v3TrackedEthThreshold,
      v3UntrackedUsdThreshold,
      v3SubgraphUrlOverride(ChainId.AVALANCHE)
    ),
  },
  {
    protocol: Protocol.V3,
    chainId: ChainId.BASE,
    timeout: 90000,
    provider: new V3SubgraphProvider(
      ChainId.BASE,
      3,
      900000, // base has more pools than other chains, so we need to increase the timeout
      true,
      v3BaseTrackedEthThreshold,
      v3UntrackedUsdThreshold,
      v3SubgraphUrlOverride(ChainId.BASE)
    ),
  },
  {
    protocol: Protocol.V3,
    chainId: ChainId.BLAST,
    timeout: 90000,
    provider: new V3SubgraphProvider(
      ChainId.BLAST,
      3,
      90000,
      true,
      v3TrackedEthThreshold,
      v3UntrackedUsdThreshold,
      v3SubgraphUrlOverride(ChainId.BLAST)
    ),
  },
  {
    protocol: Protocol.V3,
    chainId: ChainId.UNICHAIN,
    timeout: 90000,
    provider: new V3SubgraphProvider(
      ChainId.UNICHAIN,
      3,
      90000,
      true,
      v3TrackedEthThreshold,
      v3UntrackedUsdThreshold,
      v3SubgraphUrlOverride(ChainId.UNICHAIN)
    ),
  },
  {
    protocol: Protocol.V3,
    chainId: ChainId.WORLDCHAIN,
    timeout: 90000,
    provider: new V3SubgraphProvider(
      ChainId.WORLDCHAIN,
      3,
      90000,
      true,
      v3TrackedEthThreshold,
      v3UntrackedUsdThreshold,
      v3SubgraphUrlOverride(ChainId.WORLDCHAIN)
    ),
  },
  {
    protocol: Protocol.V3,
    chainId: ChainId.ZORA,
    timeout: 90000,
    provider: new V3SubgraphProvider(
      ChainId.ZORA,
      3,
      360000, // zora has more pools than other chains, so we need to increase the timeout
      true,
      v3TrackedEthThreshold,
      v3UntrackedUsdThreshold,
      v3SubgraphUrlOverride(ChainId.ZORA)
    ),
  },
  {
    protocol: Protocol.V3,
    chainId: ChainId.SONEIUM,
    timeout: 90000,
    provider: new V3SubgraphProvider(
      ChainId.SONEIUM,
      3,
      90000,
      true,
      v3TrackedEthThreshold,
      v3UntrackedUsdThreshold,
      v3SubgraphUrlOverride(ChainId.SONEIUM)
    ),
  },*/
  // V2.
  {
    protocol: Protocol.V2,
    chainId: ChainId.MAINNET,
    timeout: 840000,
    provider: new V2SubgraphProvider(
      ChainId.MAINNET,
      1,
      900000,
      true,
      1000,
      v2TrackedEthThreshold,
      v2UntrackedUsdThreshold,
      v2SubgraphUrlOverride(ChainId.MAINNET),
      process.env.GRAPH_BEARER_TOKEN  // The Graph Gateway Authorization
    ), // 1000 is the largest page size supported by thegraph
  },
  {
    protocol: Protocol.V2,
    chainId: ChainId.BNB,
    timeout: 840000,
    provider: new V2SubgraphProvider(
      ChainId.BNB,
      2,
      900000,
      true,
      1000,
      v2TrackedEthThreshold,
      v2UntrackedUsdThreshold,
      v2SubgraphUrlOverride(ChainId.BNB),
      process.env.GOLDSKY_API_KEY || process.env.GRAPH_BEARER_TOKEN_BNB // Goldsky API Key or The Graph Bearer for BNB
    ), // 1000 is the largest page size supported by thegraph
  },
  {
    protocol: Protocol.V2,
    chainId: ChainId.HYPER_MAINNET,
    timeout: 840000,
    provider: new V2SubgraphProvider(
      ChainId.HYPER_MAINNET,
      2,
      900000,
      true,
      1000,
      v2TrackedEthThreshold,
      v2UntrackedUsdThreshold,
      v2SubgraphUrlOverride(ChainId.HYPER_MAINNET),
      process.env.GOLDSKY_API_KEY // Goldsky API Key for Hyper
    ), // 1000 is the largest page size supported by thegraph
  },
  // {
  //   protocol: Protocol.V2,
  //   chainId: ChainId.MEGAETH_MAINNET,
  //   timeout: 840000,
  //   provider: new V2SubgraphProvider(
  //     ChainId.MEGAETH_MAINNET,
  //     2,
  //     900000,
  //     true,
  //     1000,
  //     v2TrackedEthThreshold,
  //     v2UntrackedUsdThreshold,
  //     v2SubgraphUrlOverride(ChainId.MEGAETH_MAINNET),
  //     process.env.GOLDSKY_API_KEY || process.env.GRAPH_BEARER_TOKEN_MEGAETH // Goldsky for MEGAETH
  //   ), // 1000 is the largest page size supported by thegraph
  // },
  {
    protocol: Protocol.V2,
    chainId: ChainId.XLAYER_MAINNET,
    timeout: 840000,
    provider: new V2SubgraphProvider(
      ChainId.XLAYER_MAINNET,
      1,
      900000,
      true,
      1000,
      v2TrackedEthThreshold,
      v2UntrackedUsdThreshold,
      v2SubgraphUrlOverride(ChainId.XLAYER_MAINNET),
      process.env.GRAPH_BEARER_TOKEN_X_LAYER  // The Graph Gateway Authorization
    ), // 1000 is the largest page size supported by thegraph
  },
  // FEWV2.
  {
    protocol: Protocol.FEWV2,
    chainId: ChainId.MAINNET,
    timeout: 840000,
    provider: new RingV2SubgraphProvider(
      ChainId.MAINNET,
      1,
      900000,
      true,
      1000,
      v2TrackedEthThreshold,
      v2UntrackedUsdThreshold,
      fewV2SubgraphUrlOverride(ChainId.MAINNET),
      process.env.GRAPH_BEARER_TOKEN  // The Graph Gateway Authorization
    ), // 1000 is the largest page size supported by thegraph
    providerFallback: new RingV2SubgraphProvider(
      ChainId.MAINNET,
      1,
      900000,
      true,
      1000,
      v2TrackedEthThreshold,
      v2UntrackedUsdThreshold,
      fewV2SubgraphUrlOverride(ChainId.MAINNET),
      "8521b63080aa70555c181d45a4face12"  // The Graph Gateway Authorization
    ),
  },
  {
    protocol: Protocol.FEWV2,
    chainId: ChainId.BNB,
    timeout: 840000,
    provider: new RingV2SubgraphProvider(
      ChainId.BNB,
      2,
      900000,
      true,
      1000,
      v2TrackedEthThreshold,
      v2UntrackedUsdThreshold,
      fewV2SubgraphUrlOverride(ChainId.BNB),
      process.env.GOLDSKY_API_KEY || process.env.GRAPH_BEARER_TOKEN_BNB // Goldsky API Key or The Graph Bearer for BNB
    ), // 1000 is the largest page size supported by thegraph
  },
  {
    protocol: Protocol.FEWV2,
    chainId: ChainId.HYPER_MAINNET,
    timeout: 840000,
    provider: new RingV2SubgraphProvider(
      ChainId.HYPER_MAINNET,
      2,
      900000,
      true,
      1000,
      v2TrackedEthThreshold,
      v2UntrackedUsdThreshold,
      fewV2SubgraphUrlOverride(ChainId.HYPER_MAINNET),
      process.env.GOLDSKY_API_KEY // Goldsky API Key for Hyper
    ), // 1000 is the largest page size supported by thegraph
  },
  // {
  //   protocol: Protocol.V2,
  //   chainId: ChainId.SEPOLIA,
  //   timeout: 840000,
  //   provider: new V2SubgraphProvider(
  //     ChainId.SEPOLIA,
  //     5,
  //     900000,
  //     true,
  //     1000,
  //     v2TrackedEthThreshold,
  //     v2UntrackedUsdThreshold,
  //     v2SubgraphUrlOverride(ChainId.SEPOLIA)
  //   ), // 1000 is the largest page size supported by thegraph
  // },
  // {
  //   protocol: Protocol.FEWV2,
  //   chainId: ChainId.SEPOLIA,
  //   timeout: 840000,
  //   provider: new RingV2SubgraphProvider(
  //     ChainId.SEPOLIA,
  //     5,
  //     900000,
  //     true,
  //     1000,
  //     v2TrackedEthThreshold,
  //     v2UntrackedUsdThreshold,
  //     v2SubgraphUrlOverride(ChainId.SEPOLIA)
  //   ), // 1000 is the largest page size supported by thegraph
  // },
  /*
  {
    protocol: Protocol.V2,
    chainId: ChainId.ARBITRUM_ONE,
    timeout: 90000,
    provider: new V2SubgraphProvider(
      ChainId.ARBITRUM_ONE,
      3,
      90000,
      true,
      1000,
      v2TrackedEthThreshold,
      v2UntrackedUsdThreshold,
      v2SubgraphUrlOverride(ChainId.ARBITRUM_ONE)
    ),
  },
  {
    protocol: Protocol.V2,
    chainId: ChainId.POLYGON,
    timeout: 90000,
    provider: new V2SubgraphProvider(
      ChainId.POLYGON,
      3,
      90000,
      true,
      1000,
      v2TrackedEthThreshold,
      v2UntrackedUsdThreshold,
      v2SubgraphUrlOverride(ChainId.POLYGON)
    ),
  },
  {
    protocol: Protocol.V2,
    chainId: ChainId.OPTIMISM,
    timeout: 90000,
    provider: new V2SubgraphProvider(
      ChainId.OPTIMISM,
      3,
      90000,
      true,
      1000,
      v2TrackedEthThreshold,
      v2UntrackedUsdThreshold,
      v2SubgraphUrlOverride(ChainId.OPTIMISM)
    ),
  },
  {
    protocol: Protocol.V2,
    chainId: ChainId.BNB,
    timeout: 90000,
    provider: new V2SubgraphProvider(
      ChainId.BNB,
      3,
      90000,
      true,
      1000,
      v2TrackedEthThreshold,
      v2UntrackedUsdThreshold,
      v2SubgraphUrlOverride(ChainId.BNB)
    ),
  },
  {
    protocol: Protocol.V2,
    chainId: ChainId.AVALANCHE,
    timeout: 90000,
    provider: new V2SubgraphProvider(
      ChainId.AVALANCHE,
      3,
      90000,
      true,
      1000,
      v2TrackedEthThreshold,
      v2UntrackedUsdThreshold,
      v2SubgraphUrlOverride(ChainId.AVALANCHE)
    ),
  },
  {
    protocol: Protocol.V2,
    chainId: ChainId.BASE,
    timeout: 840000,
    provider: new V2SubgraphProvider(
      ChainId.BASE,
      5,
      900000,
      true,
      10000,
      v2BaseTrackedEthThreshold,
      v2UntrackedUsdThreshold,
      v2SubgraphUrlOverride(ChainId.BASE)
    ),
  },
  {
    protocol: Protocol.V2,
    chainId: ChainId.BLAST,
    timeout: 90000,
    provider: new V2SubgraphProvider(
      ChainId.BLAST,
      3,
      90000,
      true,
      1000,
      v2TrackedEthThreshold,
      v2UntrackedUsdThreshold,
      v2SubgraphUrlOverride(ChainId.BLAST)
    ),
  },
  {
    protocol: Protocol.V2,
    chainId: ChainId.WORLDCHAIN,
    timeout: 90000,
    provider: new V2SubgraphProvider(
      ChainId.WORLDCHAIN,
      3,
      90000,
      true,
      1000,
      v2TrackedEthThreshold,
      v2UntrackedUsdThreshold,
      v2SubgraphUrlOverride(ChainId.WORLDCHAIN)
    ),
  },
  {
    protocol: Protocol.V2,
    chainId: ChainId.MONAD_TESTNET,
    timeout: 90000,
    provider: new V2SubgraphProvider(
      ChainId.MONAD_TESTNET,
      3,
      90000,
      true,
      1000,
      v2TrackedEthThreshold,
      v2UntrackedUsdThreshold,
      v2SubgraphUrlOverride(ChainId.MONAD_TESTNET)
    ),
  },
  {
    protocol: Protocol.V2,
    chainId: ChainId.UNICHAIN,
    timeout: 90000,
    provider: new V2SubgraphProvider(
      ChainId.UNICHAIN,
      3,
      90000,
      true,
      1000,
      v2TrackedEthThreshold,
      v2UntrackedUsdThreshold,
      v2SubgraphUrlOverride(ChainId.UNICHAIN)
    ),
  },
  {
    protocol: Protocol.V2,
    chainId: ChainId.SONEIUM,
    timeout: 90000,
    provider: new V2SubgraphProvider(
      ChainId.SONEIUM,
      3,
      90000,
      true,
      1000,
      v2TrackedEthThreshold,
      v2UntrackedUsdThreshold,
      v2SubgraphUrlOverride(ChainId.SONEIUM)
    ),
  },*/
  // V4
  {
    protocol: Protocol.V4,
    chainId: ChainId.SEPOLIA,
    timeout: 90000,
    provider: new V4SubgraphProvider(
      ChainId.SEPOLIA,
      1,
      90000,
      true,
      v4TrackedEthThreshold,
      v4BaseZoraTrackedEthThreshold,
      ZORA_HOOKS_FOR_V4_SUBGRAPH_FILTERING,
      v4UntrackedUsdThreshold,
      v4SubgraphUrlOverride(ChainId.SEPOLIA),
      process.env.GRAPH_BEARER_TOKEN
    ),
  },
  /*
  {
    protocol: Protocol.V4,
    chainId: ChainId.ARBITRUM_ONE,
    timeout: 90000,
    provider: new V4SubgraphProvider(
      ChainId.ARBITRUM_ONE,
      3,
      90000,
      true,
      v4TrackedEthThreshold,
      v4BaseZoraTrackedEthThreshold,
      ZORA_HOOKS_FOR_V4_SUBGRAPH_FILTERING,
      v4UntrackedUsdThreshold,
      v4SubgraphUrlOverride(ChainId.ARBITRUM_ONE)
    ),
  },
  {
    protocol: Protocol.V4,
    chainId: ChainId.BASE,
    timeout: 90000,
    provider: new V4SubgraphProvider(
      ChainId.BASE,
      3,
      90000,
      true,
      v4BaseTrackedEthThreshold,
      v4BaseZoraTrackedEthThreshold,
      ZORA_HOOKS_FOR_V4_SUBGRAPH_FILTERING,
      v4UntrackedUsdThreshold,
      v4SubgraphUrlOverride(ChainId.BASE),
      process.env.GRAPH_BEARER_TOKEN
    ),
  },
  {
    protocol: Protocol.V4,
    chainId: ChainId.POLYGON,
    timeout: 90000,
    provider: new V4SubgraphProvider(
      ChainId.POLYGON,
      3,
      90000,
      true,
      v4TrackedEthThreshold,
      v4BaseZoraTrackedEthThreshold,
      ZORA_HOOKS_FOR_V4_SUBGRAPH_FILTERING,
      v4UntrackedUsdThreshold,
      v4SubgraphUrlOverride(ChainId.POLYGON)
    ),
  },
  {
    protocol: Protocol.V4,
    chainId: ChainId.WORLDCHAIN,
    timeout: 90000,
    provider: new V4SubgraphProvider(
      ChainId.WORLDCHAIN,
      3,
      90000,
      true,
      v4TrackedEthThreshold,
      v4BaseZoraTrackedEthThreshold,
      ZORA_HOOKS_FOR_V4_SUBGRAPH_FILTERING,
      v4UntrackedUsdThreshold,
      v4SubgraphUrlOverride(ChainId.WORLDCHAIN)
    ),
  },
  {
    protocol: Protocol.V4,
    chainId: ChainId.ZORA,
    timeout: 90000,
    provider: new V4SubgraphProvider(
      ChainId.ZORA,
      3,
      90000,
      true,
      v4TrackedEthThreshold,
      v4BaseZoraTrackedEthThreshold,
      ZORA_HOOKS_FOR_V4_SUBGRAPH_FILTERING,
      v4UntrackedUsdThreshold,
      v4SubgraphUrlOverride(ChainId.ZORA)
    ),
  },
  {
    protocol: Protocol.V4,
    chainId: ChainId.UNICHAIN,
    timeout: 90000,
    provider: new V4SubgraphProvider(
      ChainId.UNICHAIN,
      3,
      90000,
      true,
      v4TrackedEthThreshold,
      v4BaseZoraTrackedEthThreshold,
      ZORA_HOOKS_FOR_V4_SUBGRAPH_FILTERING,
      v4UntrackedUsdThreshold,
      v4SubgraphUrlOverride(ChainId.UNICHAIN)
    ),
    eulerHooksProvider: new EulerSwapHooksSubgraphProvider(
      ChainId.UNICHAIN,
      3,
      90000,
      true,
      v4SubgraphUrlOverride(ChainId.UNICHAIN)
    ),
  },
  {
    protocol: Protocol.V4,
    chainId: ChainId.BLAST,
    timeout: 90000,
    provider: new V4SubgraphProvider(
      ChainId.BLAST,
      3,
      90000,
      true,
      v4TrackedEthThreshold,
      v4BaseZoraTrackedEthThreshold,
      ZORA_HOOKS_FOR_V4_SUBGRAPH_FILTERING,
      v4UntrackedUsdThreshold,
      v4SubgraphUrlOverride(ChainId.BLAST)
    ),
  },*/
  {
    protocol: Protocol.V4,
    chainId: ChainId.MAINNET,
    timeout: 90000,
    provider: new V4SubgraphProvider(
      ChainId.MAINNET,
      1,
      90000,
      true,
      v4TrackedEthThreshold,
      v4BaseZoraTrackedEthThreshold,
      ZORA_HOOKS_FOR_V4_SUBGRAPH_FILTERING,
      v4UntrackedUsdThreshold,
      v4SubgraphUrlOverride(ChainId.MAINNET),
      process.env.GRAPH_BEARER_TOKEN
    ),
    eulerHooksProvider: new EulerSwapHooksSubgraphProvider(
      ChainId.MAINNET,
      2,
      90000,
      true,
      v4SubgraphUrlOverride(ChainId.MAINNET),
      process.env.GRAPH_BEARER_TOKEN
    ),
  },
  {
    protocol: Protocol.V4,
    chainId: ChainId.BNB,
    timeout: 90000,
    provider: new V4SubgraphProvider(
      ChainId.BNB,
      3,
      90000,
      true,
      v4TrackedEthThreshold,
      v4BaseZoraTrackedEthThreshold,
      ZORA_HOOKS_FOR_V4_SUBGRAPH_FILTERING,
      v4UntrackedUsdThreshold,
      v4SubgraphUrlOverride(ChainId.BNB),
      process.env.GOLDSKY_API_KEY || process.env.GRAPH_BEARER_TOKEN_BNB // Goldsky API Key or The Graph Bearer for BNB
    ),
  },
  // {
  //   protocol: Protocol.V4,
  //   chainId: ChainId.MEGAETH_MAINNET,
  //   timeout: 90000,
  //   provider: new V4SubgraphProvider(
  //     ChainId.MEGAETH_MAINNET,
  //     3,
  //     90000,
  //     true,
  //     v4TrackedEthThreshold,
  //     v4BaseZoraTrackedEthThreshold,
  //     ZORA_HOOKS_FOR_V4_SUBGRAPH_FILTERING,
  //     v4UntrackedUsdThreshold,
  //     v4SubgraphUrlOverride(ChainId.MEGAETH_MAINNET),
  //     process.env.GOLDSKY_API_KEY || process.env.GRAPH_BEARER_TOKEN_MEGAETH // Goldsky for MEGAETH
  //   ),
  // },
  /*
  {
    protocol: Protocol.V4,
    chainId: ChainId.SONEIUM,
    timeout: 90000,
    provider: new V4SubgraphProvider(
      ChainId.SONEIUM,
      3,
      90000,
      true,
      v4TrackedEthThreshold,
      v4BaseZoraTrackedEthThreshold,
      ZORA_HOOKS_FOR_V4_SUBGRAPH_FILTERING,
      v4UntrackedUsdThreshold,
      v4SubgraphUrlOverride(ChainId.SONEIUM)
    ),
  },
  {
    protocol: Protocol.V4,
    chainId: ChainId.OPTIMISM,
    timeout: 90000,
    provider: new V4SubgraphProvider(
      ChainId.OPTIMISM,
      3,
      90000,
      true,
      v4TrackedEthThreshold,
      v4BaseZoraTrackedEthThreshold,
      ZORA_HOOKS_FOR_V4_SUBGRAPH_FILTERING,
      v4UntrackedUsdThreshold,
      v4SubgraphUrlOverride(ChainId.OPTIMISM)
    ),
  },
  {
    protocol: Protocol.V4,
    chainId: ChainId.BNB,
    timeout: 90000,
    provider: new V4SubgraphProvider(
      ChainId.BNB,
      3,
      90000,
      true,
      v4TrackedEthThreshold,
      v4BaseZoraTrackedEthThreshold,
      ZORA_HOOKS_FOR_V4_SUBGRAPH_FILTERING,
      v4UntrackedUsdThreshold,
      v4SubgraphUrlOverride(ChainId.BNB)
    ),
  },*/
]
