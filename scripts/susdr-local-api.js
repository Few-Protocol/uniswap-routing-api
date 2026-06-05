const http = require('http')

const {
  susdrLiquidityHandler,
  susdrReadinessHandler,
  susdrRedeemSimHandler,
  susdrStatusHandler,
  susdrV2PoolsHandler,
} = require('../lib/handlers/susdr')

const handlerByPath = {
  '/susdr/status': susdrStatusHandler,
  '/susdr/liquidity': susdrLiquidityHandler,
  '/susdr/readiness': susdrReadinessHandler,
  '/susdr/redeem-sim': susdrRedeemSimHandler,
  '/susdr/v2-pools': susdrV2PoolsHandler,
}

function queryParams(url) {
  return Object.fromEntries(url.searchParams.entries())
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://127.0.0.1:4000')
    const handler = handlerByPath[url.pathname]

    if (!handler) {
      res.writeHead(404, { 'access-control-allow-origin': '*', 'content-type': 'application/json' })
      res.end(JSON.stringify({ errorCode: 'NOT_FOUND' }))
      return
    }

    const result = await handler(
      {
        path: url.pathname,
        httpMethod: req.method || 'GET',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: queryParams(url),
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {},
        resource: url.pathname,
        body: null,
        isBase64Encoded: false,
      },
      { awsRequestId: `local-${Date.now()}` }
    )

    res.writeHead(
      result.statusCode,
      result.headers || { 'access-control-allow-origin': '*', 'content-type': 'application/json' }
    )
    res.end(result.body)
  } catch (error) {
    res.writeHead(500, { 'access-control-allow-origin': '*', 'content-type': 'application/json' })
    res.end(JSON.stringify({ errorCode: 'LOCAL_SERVER_ERROR', detail: error.message }))
  }
})

const port = Number(process.env.SUSDR_LOCAL_API_PORT || 4000)
server.listen(port, '127.0.0.1', () => {
  console.log(`sUSDR local API listening on http://127.0.0.1:${port}`)
})
