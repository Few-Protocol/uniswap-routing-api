curl -X GET "https://3so7p0ss88.execute-api.us-east-1.amazonaws.com/prod/quote?tokenInAddress=ETH&tokenOutAddress=0xf6b1117ec07684D3958caD8BEb1b302bfD21103f&tokenInChainId=1&tokenOutChainId=1&amount=100000000000000000&type=exactIn&slippageTolerance=0.5&deadline=10800&protocols=fewv2" \
  -H "User-Agent: Cloudflare Worker" \
  -H "Accept: application/json" \
  -H "x-api-key: TRADING_API_KEY" \
  -H "x-app-version: " \
  -H "x-request-source: uniswap-web" \
  -H "x-uniquote-enabled: true" \
  -H "x-universal-router-version: 2.0" \
  -H "x-viem-provider-enabled: false" \
  -H "ringallowed: ring"
