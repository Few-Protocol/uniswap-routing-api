import { Pair as FewPair } from '@ring-protocol/few-v2-sdk'
import { CurrencyAmountMarshaller, MarshalledCurrencyAmount } from './currency-amount-marshaller'
  import { Protocol } from '@uniswap/router-sdk'

export interface MarshalledFewV2Pair {
  protocol: Protocol
  currencyAmountA: MarshalledCurrencyAmount
  tokenAmountB: MarshalledCurrencyAmount
}

export class FewV2PairMarshaller {
  public static marshalFewPair(pair: FewPair): MarshalledFewV2Pair {
    return {
      protocol: Protocol.FEWV2,
      currencyAmountA: CurrencyAmountMarshaller.marshal(pair.reserve0),
      tokenAmountB: CurrencyAmountMarshaller.marshal(pair.reserve1),
    }
  }

  public static unmarshalFewPair(marshalledPair: MarshalledFewV2Pair): FewPair {
    return new FewPair(
      CurrencyAmountMarshaller.unmarshal(marshalledPair.currencyAmountA).wrapped,
      CurrencyAmountMarshaller.unmarshal(marshalledPair.tokenAmountB).wrapped
    )
  }
}
