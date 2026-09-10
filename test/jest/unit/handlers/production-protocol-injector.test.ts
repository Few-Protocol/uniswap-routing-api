import bunyan from 'bunyan'
import { StaticJsonRpcProvider } from '@ethersproject/providers'
import { ChainId } from '@ring-protocol/sdk-core'
import { AlphaRouter, MIXED_ROUTE_QUOTER_V2_ADDRESSES } from '@ring-protocol/smart-order-router'
import { Protocol } from '@ring-protocol/router-sdk'
import { InjectorSOR } from '../../../../lib/handlers/injector-sor'
import { QuoteHandlerInjector } from '../../../../lib/handlers/quote/injector'
import { AWSTokenListProvider } from '../../../../lib/handlers/router-entities/aws-token-list-provider'
import { GlobalRpcProviders } from '../../../../lib/rpc/GlobalRpcProviders'

describe('production container and request protocol configuration', () => {
  const noop = () => undefined
  const logger: any = { info: noop, error: noop, warn: noop, debug: noop, trace: noop, fatal: noop, child: () => logger }
  const metrics: any = { setNamespace: noop, setDimensions: noop, putMetric: noop }
  const tokenList: any = { getTokenByAddress: async () => undefined, getTokenBySymbol: async () => undefined }

  test.each([ChainId.BNB, ChainId.HYPER_MAINNET, ChainId.ROBINHOOD])('chain %s reaches the real AlphaRouter with its production capability lists', async chainId => {
    const logFactory = jest.spyOn(bunyan, 'createLogger').mockReturnValue(logger)
    const provider = new StaticJsonRpcProvider('http://127.0.0.1:1', chainId)
    const noRpc = jest.spyOn(provider, 'send').mockRejectedValue(new Error('OFFLINE_TEST_RPC_FORBIDDEN'))
    const gateway = jest.spyOn(GlobalRpcProviders, 'getGlobalUniRpcProviders').mockReturnValue(new Map([[chainId, provider]]) as any)
    const tokenSource = jest.spyOn(AWSTokenListProvider, 'fromTokenListS3Bucket').mockResolvedValue(tokenList)
    const subgraphSource = jest.spyOn(InjectorSOR.prototype as any, 'instantiateSubgraphProvider').mockResolvedValue({ getPools: async () => [] })
    const previous = process.env.CACHED_ROUTES_TABLE_NAME
    delete process.env.CACHED_ROUTES_TABLE_NAME
    try {
      const injector = new QuoteHandlerInjector('production-protocol-test')
      const container = await injector.buildContainerInjected()
      const dependencies = container.dependencies[chainId]!
      for (const list of [dependencies.v2Supported, dependencies.v4Supported, dependencies.mixedSupported]) {
        expect(list).toContain(chainId)
      }
      const request = await injector.getRequestInjected(container, undefined as any, {
        tokenInAddress: '0x0000000000000000000000000000000000000010', tokenOutAddress: '0x0000000000000000000000000000000000000011',
        tokenInChainId: chainId, tokenOutChainId: chainId, amount: '1000000', type: 'exactIn', algorithm: 'alpha',
      } as any, {} as any, { awsRequestId: 'production-protocol-test' } as any, logger, metrics)
      expect(request.router).toBeInstanceOf(AlphaRouter)
      for (const property of ['v2Supported', 'v4Supported', 'mixedSupported']) {
        expect((request.router as any)[property]).toContain(chainId)
      }
      if (chainId === ChainId.ROBINHOOD) {
        const current = (dependencies.onChainQuoteProvider as any).currentQuoteProvider
        expect(current.getQuoterAddress(true, true, Protocol.MIXED)).toBe(MIXED_ROUTE_QUOTER_V2_ADDRESSES[chainId])
      }
      expect(noRpc).not.toHaveBeenCalled()
    } finally {
      logFactory.mockRestore(); gateway.mockRestore(); tokenSource.mockRestore(); subgraphSource.mockRestore(); noRpc.mockRestore()
      if (previous === undefined) delete process.env.CACHED_ROUTES_TABLE_NAME
      else process.env.CACHED_ROUTES_TABLE_NAME = previous
    }
  })
})
