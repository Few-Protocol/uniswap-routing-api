import { describe, expect, jest } from '@jest/globals'
import { ExtendedEther, nativeOnChain } from '@ring-protocol/smart-order-router'
import { ChainId, Token } from '@ring-protocol/sdk-core'
import { CurrencyLookup } from '../../../../lib/handlers/CurrencyLookup'

const address = '0x0000000000000000000000000000000000000001'
const token = new Token(ChainId.MAINNET, address, 18, 'FOO', 'Foo')

describe('CurrencyLookup', () => {
  it.each([
    [ChainId.MAINNET, 'ETH'],
    [ChainId.BNB, 'BNB'],
    [ChainId.BASE, 'ETH'],
    [ChainId.ARBITRUM_ONE, 'ETH'],
    [ChainId.HYPER_MAINNET, 'HYPE'],
    [ChainId.ROBINHOOD, 'ETH'],
    [ChainId.INK, 'ETH'],
  ])('Preserves native lookup for wrapped-native chain %s', async (chainId, symbol) => {
    const lookup = new CurrencyLookup({} as any, {} as any, { debug: jest.fn() } as any)
    expect(await lookup.searchForToken(symbol as string, chainId as number)).toEqual(nativeOnChain(chainId as number))
  })

  it.each(['USDC', '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'])(
    'Rejects unsupported native input %s before token lookup', async (symbol) => {
      const lookup = new CurrencyLookup({} as any, {} as any, { debug: jest.fn() } as any)
      expect(await lookup.searchForToken(symbol, ChainId.ARC)).toBeUndefined()
    }
  )

  it('Still resolves the six-decimal ERC-20 representation on a chain without wrapped native', async () => {
    const usdc = new Token(ChainId.ARC, '0x3600000000000000000000000000000000000000', 6, 'USDC')
    const lookup = new CurrencyLookup(
      { getTokenByAddress: () => usdc } as any, {} as any, { debug: jest.fn() } as any
    )
    expect(await lookup.searchForToken(usdc.address, ChainId.ARC)).toBe(usdc)
  })

  it('Returns the native token if tokenRaw is a native token string', async () => {
    const tokenLookup = new CurrencyLookup(
      {} as any, // tokenListProvider
      {} as any, // tokenProvider,
      {
        debug: jest.fn(),
      } as any // log
    )
    const result = await tokenLookup.searchForToken('ETH', ChainId.MAINNET)

    expect(result).toBeDefined()
    expect(result).toEqual(ExtendedEther.onChain(ChainId.MAINNET))
  })

  it('Finds the token in the token list when the input is an address', async () => {
    const tokenLookup = new CurrencyLookup(
      {
        getTokenByAddress: (inputAddress: string) => (inputAddress === address ? token : undefined),
      } as any, // tokenListProvider
      {} as any, // tokenProvider,
      {
        debug: jest.fn(),
      } as any // log
    )
    const result = await tokenLookup.searchForToken(address, ChainId.MAINNET)

    expect(result).toBeDefined()
    expect(result).toEqual(token)
  })

  it('Finds the token in the token list when the input is a symbol', async () => {
    const tokenLookup = new CurrencyLookup(
      {
        getTokenBySymbol: (inputSymbol: string) => (inputSymbol === 'FOO' ? token : undefined),
      } as any, // tokenListProvider
      {} as any, // tokenProvider,
      {
        debug: jest.fn(),
      } as any // log
    )
    const result = await tokenLookup.searchForToken('FOO', ChainId.MAINNET)

    expect(result).toBeDefined()
    expect(result).toEqual(token)
  })

  it('Returns the token if the on-chain lookup by address is successful', async () => {
    const tokenLookup = new CurrencyLookup(
      {
        // Both token list lookups return null
        getTokenBySymbol: () => undefined,
        getTokenByAddress: () => undefined,
      } as any, // tokenListProvider
      {
        getTokens: () => {
          return {
            getTokenByAddress: (inputAddress: string) => (inputAddress === address ? token : undefined),
          }
        },
      } as any, // tokenProvider,
      {
        debug: jest.fn(),
      } as any // log
    )
    const result = await tokenLookup.searchForToken(address, ChainId.MAINNET)

    // Because the input address was a symbol and not an address, expect the result to be undefined.
    expect(result).toBe(token)
  })

  it('Returns undefined if the on-chain lookup is by symbol', async () => {
    const tokenLookup = new CurrencyLookup(
      {
        // Both token list lookups return null
        getTokenBySymbol: () => undefined,
        getTokenByAddress: () => undefined,
      } as any, // tokenListProvider
      {
        getTokens: () => {
          return {
            getTokenByAddress: (inputAddress: string) => (inputAddress === address ? token : undefined),
          }
        },
      } as any, // tokenProvider,
      {
        debug: jest.fn(),
      } as any // log
    )
    const result = await tokenLookup.searchForToken('FOO', ChainId.MAINNET)

    // Because the input address was a symbol and not an address, expect the result to be undefined.
    expect(result).toBeUndefined()
  })
})
