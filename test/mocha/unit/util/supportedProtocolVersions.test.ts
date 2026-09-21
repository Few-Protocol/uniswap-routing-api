import { UniversalRouterVersion } from '@ring-protocol/universal-router-sdk'
import {
  convertStringRouterVersionToEnum,
  protocolVersionsToBeExcludedFromMixed,
} from '../../../../lib/util/supportedProtocolVersions'
import { Protocol } from '@uniswap/router-sdk'
import { expect } from 'chai'

describe('supported protocol versions', () => {
  it('should convert string router version to enum', async () => {
    expect(convertStringRouterVersionToEnum('1.2')).to.eq(UniversalRouterVersion.V1_2)
    expect(convertStringRouterVersionToEnum('2.1.1')).to.eq(UniversalRouterVersion.V2_1_1)
    expect(convertStringRouterVersionToEnum('2.0')).to.eq(UniversalRouterVersion.V2_0)
    expect(convertStringRouterVersionToEnum('3.0')).to.eq(UniversalRouterVersion.V1_2)
    expect(convertStringRouterVersionToEnum(undefined)).to.eq(UniversalRouterVersion.V1_2)
  })

  it('should return protocol versions to be excluded from mixed', async () => {
    expect(protocolVersionsToBeExcludedFromMixed(UniversalRouterVersion.V1_2)).to.deep.eq([Protocol.V4])
    expect(protocolVersionsToBeExcludedFromMixed(UniversalRouterVersion.V2_1_1)).to.deep.eq([])
    expect(protocolVersionsToBeExcludedFromMixed(UniversalRouterVersion.V2_0)).to.deep.eq([])
  })
})
