import bunyan from 'bunyan'
import { StaticJsonRpcProvider } from '@ethersproject/providers'
import { ChainId, CurrencyAmount, Token } from '@ring-protocol/sdk-core'
import { AlphaRouter, MIXED_ROUTE_QUOTER_V1_ADDRESSES, MIXED_ROUTE_QUOTER_V2_ADDRESSES, V2Route } from '@ring-protocol/smart-order-router'
import { Pair } from '@ring-protocol/v2-sdk'
import { BigNumber } from 'ethers'
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
      if (chainId === ChainId.BNB || chainId === ChainId.ROBINHOOD) {
        const useV2 = !MIXED_ROUTE_QUOTER_V1_ADDRESSES[chainId]
        const tokenA = new Token(chainId, '0x0000000000000000000000000000000000000010', 18, 'A')
        const tokenB = new Token(chainId, '0x0000000000000000000000000000000000000011', 18, 'B')
        const pair = new Pair(CurrencyAmount.fromRawAmount(tokenA, '1000000'), CurrencyAmount.fromRawAmount(tokenB, '1000000'))
        const route = new V2Route([pair], tokenA, tokenB)
        const blockNumber = jest.spyOn(provider, 'getBlockNumber').mockResolvedValue(123)
        try {
          for (const name of ['currentQuoteProvider', 'targetQuoteProvider']) {
            const quoter = (dependencies.onChainQuoteProvider as any)[name]
            quoter.retryOptions = { retries: 0 }
            const multicall = jest.spyOn(quoter.multicall2Provider, 'callSameFunctionOnContractWithMultipleParams')
              .mockImplementation(async (params: any) => {
                expect(params.address).toBe(useV2 ? MIXED_ROUTE_QUOTER_V2_ADDRESSES[chainId] : MIXED_ROUTE_QUOTER_V1_ADDRESSES[chainId])
                expect(params.functionParams[0]).toHaveLength(useV2 ? 3 : 2)
                return {
                  blockNumber: BigNumber.from(123), approxGasUsedPerSuccessCall: 100000,
                  results: [{ success: true, result: useV2
                    ? [BigNumber.from(99), BigNumber.from(100000)]
                    : [BigNumber.from(99), [], [], BigNumber.from(100000)] }],
                }
              })
            try {
              const result = await quoter.getQuotesManyExactIn([CurrencyAmount.fromRawAmount(tokenA, '100')], [route])
              expect(result.routesWithQuotes[0][1][0].quote.toString()).toBe('99')
              expect(multicall).toHaveBeenCalledTimes(1)
            } finally {
              multicall.mockRestore()
            }
          }
        } finally {
          blockNumber.mockRestore()
        }
      }
      expect(noRpc).not.toHaveBeenCalled()
    } finally {
      logFactory.mockRestore(); gateway.mockRestore(); tokenSource.mockRestore(); subgraphSource.mockRestore(); noRpc.mockRestore()
      if (previous === undefined) delete process.env.CACHED_ROUTES_TABLE_NAME
      else process.env.CACHED_ROUTES_TABLE_NAME = previous
    }
  })
})
