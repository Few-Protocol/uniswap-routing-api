#!/usr/bin/env bash
set -euo pipefail
REGION="us-east-1"
PROFILE="tbbeta"

# 入参: beta 或 prod，默认 prod
ENV="${1:-prod}"

# API URL 前缀
prod_url=4oca7hicnc
beta_url=3so7p0ss88

# 根据入参选择 URL
if [[ "$ENV" == "beta" ]]; then
  API_URL="${beta_url}"
  API_STAGE="beta"
else
  API_URL="${prod_url}"
  API_STAGE="prod"
fi

echo "Testing environment: $ENV (API_STAGE: $API_STAGE)"
echo "=========================================="

# chain id to test (要测试的链ID列表)
TO_TEST_CHAIN_ID=(196 1)

# tokenIn,tokenOut (每条链对应的代币地址)
CHAIN_196='0x5a77f1443d16ee5761d310e38b62f77f726bc71c,0x779ded0c9e1022225f8e0630b35a9b54be713736'
CHAIN_1='ETH,0xdAC17F958D2ee523a2206206994597C13D831ec7'
CHAIN_56='0x0000000000000000000000000000000000000000,0x0000000000000000000000000000000000000000'
CHAIN_999='0x0000000000000000000000000000000000000000,0x0000000000000000000000000000000000000000'

# amount, eth:1000000000000000000, usdt 1000000
AMOUNT_ETH=100000000000000000
AMOUNT_USDT=1000000

# 遍历所有要测试的链
for CHAIN_ID in "${TO_TEST_CHAIN_ID[@]}"; do
  echo ""
  echo ">>> Testing Chain ID: $CHAIN_ID"
  
  # 动态获取对应链的代币配置 (CHAIN_xxx 变量)
  CHAIN_VAR="CHAIN_${CHAIN_ID}"
  TOKEN_PAIR="${!CHAIN_VAR}"
  
  # 解析 tokenIn 和 tokenOut
  TOKEN_IN=$(echo "$TOKEN_PAIR" | cut -d',' -f1)
  TOKEN_OUT=$(echo "$TOKEN_PAIR" | cut -d',' -f2)
  
  echo "  tokenIn:  $TOKEN_IN"
  echo "  tokenOut: $TOKEN_OUT"
  echo "  amount:   $AMOUNT_ETH"
  echo ""
  
  # 构建请求 URL
  REQUEST_URL="https://${API_URL}.execute-api.us-east-1.amazonaws.com/${API_STAGE}/quote?tokenInAddress=${TOKEN_IN}&tokenOutAddress=${TOKEN_OUT}&tokenInChainId=${CHAIN_ID}&tokenOutChainId=${CHAIN_ID}&amount=${AMOUNT_ETH}&type=exactIn&slippageTolerance=0.5&deadline=10800&protocols=fewv2%2cv2%2cv3%2cv4"
  
  # 打印完整 curl 命令
  echo ">>> CURL Command:"
  echo "curl -X GET \"${REQUEST_URL}\" \\"
  echo "  -H \"User-Agent: Cloudflare Worker\" \\"
  echo "  -H \"Accept: application/json\" \\"
  echo "  -H \"x-api-key: TRADING_API_KEY\" \\"
  echo "  -H \"x-app-version: \" \\"
  echo "  -H \"x-request-source: uniswap-web\" \\"
  echo "  -H \"x-uniquote-enabled: true\" \\"
  echo "  -H \"x-universal-router-version: 2.0\" \\"
  echo "  -H \"x-viem-provider-enabled: false\" \\"
  echo "  -H \"ringallowed: ring\""
  echo ""
  
  # 发起请求并保存结果
  echo ">>> Response:"
  RESPONSE=$(curl -s -X GET "${REQUEST_URL}" \
    -H "User-Agent: Cloudflare Worker" \
    -H "Accept: application/json" \
    -H "x-api-key: TRADING_API_KEY" \
    -H "x-app-version: " \
    -H "x-request-source: uniswap-web" \
    -H "x-uniquote-enabled: true" \
    -H "x-universal-router-version: 2.0" \
    -H "x-viem-provider-enabled: false" \
    -H "ringallowed: ring")
  
  # 打印格式化的响应结果
  echo "$RESPONSE" | jq .
  
  echo ""
  echo "=========================================="
done

echo "All tests completed!"
