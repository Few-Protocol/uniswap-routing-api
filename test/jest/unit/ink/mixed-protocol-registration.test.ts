import { readFileSync } from 'fs'
import path from 'path'
import ts from 'typescript'
import { ChainId } from '@ring-protocol/sdk-core'
import { MIXED_SUPPORTED, MIXED_ROUTE_QUOTER_V1_ADDRESSES, MIXED_ROUTE_QUOTER_V2_ADDRESSES } from '@ring-protocol/smart-order-router'

// The API supplies this list to AlphaRouter, overriding its SDK default.
// Inspect the actual config so a new network cannot silently bypass the SDK gate.
const source = ts.createSourceFile('injector-sor.ts', readFileSync(path.resolve(__dirname,
  '../../../../lib/handlers/injector-sor.ts'), 'utf8'), ts.ScriptTarget.Latest, true)
let configured: number[] | undefined
function visit(node: ts.Node): void {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'mixedSupported' && node.initializer && ts.isArrayLiteralExpression(node.initializer)) {
    configured = node.initializer.elements.map(element => {
      if (!ts.isPropertyAccessExpression(element)) throw new Error('Review new mixedSupported config syntax')
      return ChainId[element.name.text as keyof typeof ChainId] as number
    })
  }
  ts.forEachChild(node, visit)
}
visit(source)

test.each([ChainId.ARC, ChainId.INK])('new chain %s retains the SDK mixed-quoter capability', chainId => {
  expect(configured).toBeDefined()
  const supported = MIXED_SUPPORTED.includes(chainId)
  expect(configured!.includes(chainId)).toBe(supported)
  expect(Boolean(MIXED_ROUTE_QUOTER_V1_ADDRESSES[chainId] || MIXED_ROUTE_QUOTER_V2_ADDRESSES[chainId])).toBe(supported)
})
