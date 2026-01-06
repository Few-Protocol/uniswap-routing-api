import { ChainId } from '@ring-protocol/sdk-core'
import { ADDRESS_ZERO } from '@ring-protocol/router-sdk'
import { nativeOnChain } from '@ring-protocol/smart-order-router/build/main/util/chains'
export function getSymbolOrAddress(address: string, chainId: ChainId): string {
  if (address === ADDRESS_ZERO) {
    return nativeOnChain(chainId)?.symbol ?? 'ETH'
  } else {
    return address
  }
}
