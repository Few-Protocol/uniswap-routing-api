import { getSymbolOrAddress } from '../../../../lib/util/getSymbolOrAddress'
import { ADDRESS_ZERO } from '@ring-protocol/router-sdk'
import { ChainId } from '@ring-protocol/sdk-core'
import { expect } from 'chai'

describe('get symbol or address', () => {
  it('should get symbol or address on L1', async () => {
    expect(getSymbolOrAddress(ADDRESS_ZERO, ChainId.MAINNET)).to.eq('ETH')
  })

  it('should get symbol or address on Polygon', async () => {
    expect(getSymbolOrAddress(ADDRESS_ZERO, ChainId.POLYGON)).to.eq('MATIC')
  })
})
