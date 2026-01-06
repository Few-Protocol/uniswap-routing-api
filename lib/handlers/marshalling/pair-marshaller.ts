import { Pair } from '@ring-protocol/v2-sdk'
import { Pair as FewPair } from '@ring-protocol/few-v2-sdk'
import { CurrencyAmountMarshaller, MarshalledCurrencyAmount } from './currency-amount-marshaller'
import { Protocol } from '@ring-protocol/router-sdk'

export interface MarshalledPair {
  protocol: Protocol
  currencyAmountA: MarshalledCurrencyAmount
  tokenAmountB: MarshalledCurrencyAmount
}

export class PairMarshaller {
  public static marshal(pair: Pair): MarshalledPair {
    return {
      protocol: Protocol.V2,
      currencyAmountA: CurrencyAmountMarshaller.marshal(pair.reserve0),
      tokenAmountB: CurrencyAmountMarshaller.marshal(pair.reserve1),
    }
  }

  public static marshalFewPair(pair: FewPair): MarshalledPair {
    return {
      protocol: Protocol.FEWV2,
      currencyAmountA: CurrencyAmountMarshaller.marshal(pair.reserve0),
      tokenAmountB: CurrencyAmountMarshaller.marshal(pair.reserve1),
    }
  }

  public static unmarshal(marshalledPair: MarshalledPair): Pair {
    return new Pair(
      CurrencyAmountMarshaller.unmarshal(marshalledPair.currencyAmountA).wrapped,
      CurrencyAmountMarshaller.unmarshal(marshalledPair.tokenAmountB).wrapped
    )
  }

  public static unmarshalFewPair(marshalledPair: MarshalledPair): FewPair {
    return new FewPair(
      CurrencyAmountMarshaller.unmarshal(marshalledPair.currencyAmountA).wrapped,
      CurrencyAmountMarshaller.unmarshal(marshalledPair.tokenAmountB).wrapped
    )
  }
}
