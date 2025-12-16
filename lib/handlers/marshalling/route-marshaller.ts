import { MixedRoute, V2Route, V3Route, V4Route, RingFewV2Route } from '@uniswap/smart-order-router/build/main/routers'
import { Protocol } from '@uniswap/router-sdk'
import { MarshalledCurrency, TokenMarshaller } from './token-marshaller'
import { MarshalledPair, PairMarshaller } from './pair-marshaller'
import { MarshalledFewV2Pair, FewV2PairMarshaller } from './few-pair-marshaller'
import { MarshalledPool as V3MarshalledPool, PoolMarshaller as V3PoolMarshaller } from './v3/pool-marshaller'
import { MarshalledPool as V4MarshalledPool, PoolMarshaller as V4PoolMarshaller } from './v4/pool-marshaller'
import { Pool as V3Pool } from '@uniswap/v3-sdk'
import { Pool as V4Pool } from '@uniswap/v4-sdk'
import { SupportedRoutes } from '@uniswap/smart-order-router'
import { Pair } from '@uniswap/v2-sdk'
import { Pair as FewV2Pair } from '@ring-protocol/few-v2-sdk'
export interface MarshalledV2Route {
  protocol: Protocol
  input: MarshalledCurrency
  output: MarshalledCurrency
  pairs: MarshalledPair[]
}

export interface MarshalledFewV2Route {
  protocol: Protocol
  input: MarshalledCurrency
  output: MarshalledCurrency
  pairs: MarshalledFewV2Pair[]
}

export interface MarshalledV3Route {
  protocol: Protocol
  input: MarshalledCurrency
  output: MarshalledCurrency
  pools: V3MarshalledPool[]
}

export interface MarshalledV4Route {
  protocol: Protocol
  input: MarshalledCurrency
  output: MarshalledCurrency
  pools: V4MarshalledPool[]
}

export interface MarshalledMixedRoute {
  protocol: Protocol
  input: MarshalledCurrency
  output: MarshalledCurrency
  pools: (V4MarshalledPool | V3MarshalledPool | MarshalledPair | MarshalledFewV2Pair)[]
}

export type MarshalledRoute = MarshalledV2Route | MarshalledFewV2Route | MarshalledV3Route | MarshalledMixedRoute

export class RouteMarshaller {
  public static marshal(route: SupportedRoutes): MarshalledRoute {
    switch (route.protocol) {
      case Protocol.FEWV2:
        return {
          protocol: Protocol.FEWV2,
          input: TokenMarshaller.marshal(route.input),
          output: TokenMarshaller.marshal(route.output),
          pairs: route.pairs.map((pair) => FewV2PairMarshaller.marshalFewPair(pair)),
        }
      case Protocol.V2:
        return {
          protocol: Protocol.V2,
          input: TokenMarshaller.marshal(route.input),
          output: TokenMarshaller.marshal(route.output),
          pairs: route.pairs.map((pair) => PairMarshaller.marshal(pair)),
        }
      case Protocol.V3:
        return {
          protocol: Protocol.V3,
          input: TokenMarshaller.marshal(route.input),
          output: TokenMarshaller.marshal(route.output),
          pools: route.pools.map((pool) => V3PoolMarshaller.marshal(pool)),
        }
      case Protocol.V4:
        return {
          protocol: Protocol.V4,
          input: TokenMarshaller.marshal(route.input),
          output: TokenMarshaller.marshal(route.output),
          pools: route.pools.map((pool) => V4PoolMarshaller.marshal(pool)),
        }
      case Protocol.MIXED:
        return {
          protocol: Protocol.MIXED,
          input: TokenMarshaller.marshal(route.input),
          output: TokenMarshaller.marshal(route.output),
          pools: route.pools.map((tpool) => {
            if (tpool instanceof V3Pool) {
              return V3PoolMarshaller.marshal(tpool)
            } else if (tpool instanceof V4Pool) {
              return V4PoolMarshaller.marshal(tpool)
            } else if (tpool instanceof Pair) {
              return PairMarshaller.marshal(tpool)
            } else if (tpool instanceof FewV2Pair) {
              return FewV2PairMarshaller.marshalFewPair(tpool)
            } else {
              throw new Error(`Unsupported pool type ${JSON.stringify(tpool)}`)
            }
          }),
        }
      default:
        throw new Error(`Unsupported protocol ${JSON.stringify(route)}`)
    }
  }

  public static unmarshal(marshalledRoute: MarshalledRoute): SupportedRoutes {
    switch (marshalledRoute.protocol) {
      case Protocol.FEWV2:
        const fewv2Route = marshalledRoute as MarshalledFewV2Route
        return new RingFewV2Route(
          fewv2Route.pairs.map((marshalledPair) => FewV2PairMarshaller.unmarshalFewPair(marshalledPair)),
          TokenMarshaller.unmarshal(fewv2Route.input).wrapped,
          TokenMarshaller.unmarshal(fewv2Route.output).wrapped
        )
      case Protocol.V2:
        const v2Route = marshalledRoute as MarshalledV2Route
        return new V2Route(
          v2Route.pairs.map((marshalledPair) => PairMarshaller.unmarshal(marshalledPair)),
          TokenMarshaller.unmarshal(v2Route.input).wrapped,
          TokenMarshaller.unmarshal(v2Route.output).wrapped
        )
      case Protocol.V3:
        const v3Route = marshalledRoute as MarshalledV3Route
        return new V3Route(
          v3Route.pools.map((marshalledPool) => V3PoolMarshaller.unmarshal(marshalledPool)),
          TokenMarshaller.unmarshal(v3Route.input).wrapped,
          TokenMarshaller.unmarshal(v3Route.output).wrapped
        )
      case Protocol.V4:
        const v4Route = marshalledRoute as MarshalledV4Route
        return new V4Route(
          v4Route.pools.map((marshalledPool) => V4PoolMarshaller.unmarshal(marshalledPool)),
          TokenMarshaller.unmarshal(v4Route.input),
          TokenMarshaller.unmarshal(v4Route.output)
        )
      case Protocol.MIXED:
        const mixedRoute = marshalledRoute as MarshalledMixedRoute
        const tpools = mixedRoute.pools.map((tpool) => {
          switch (tpool.protocol) {
            case Protocol.V2:
              return PairMarshaller.unmarshal(tpool as MarshalledPair)
            case Protocol.V3:
              return V3PoolMarshaller.unmarshal(tpool as V3MarshalledPool)
            case Protocol.V4:
              return V4PoolMarshaller.unmarshal(tpool as V4MarshalledPool)
            case Protocol.FEWV2:
              return FewV2PairMarshaller.unmarshalFewPair(tpool as MarshalledFewV2Pair)
            default:
              throw new Error(`Unsupported protocol ${JSON.stringify(tpool)}`)
          }
        })

        return new MixedRoute(
          tpools,
          TokenMarshaller.unmarshal(mixedRoute.input),
          TokenMarshaller.unmarshal(mixedRoute.output)
        )
    }
  }
}
