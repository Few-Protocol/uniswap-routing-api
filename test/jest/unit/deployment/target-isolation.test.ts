import { spawnSync } from 'child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { resolve, join } from 'path'

describe('deployment target isolation', () => {
  test.each([
    ['beta', 'tbbeta'],
    ['prod', 'ringprod'],
  ])('%s selects only its intended AWS profile', (target, profile) => {
    const directory = mkdtempSync(join(tmpdir(), 'ring-deploy-test-'))
    const bin = join(directory, 'bin')
    const calls = join(directory, 'calls')
    mkdirSync(bin)
    const stub = '#!/bin/sh\nprintf "%s %s\\n" "$(basename "$0")" "$*" >> "$RING_TEST_CALL_LOG"\n'
    for (const name of ['npm', 'npx', 'yarn', 'cdk']) {
      writeFileSync(join(bin, name), stub, { mode: 0o755 })
    }
    const configuration = [
      'WEB3_RPC_1=https://ethereum.example.invalid',
      'WEB3_RPC_56=https://bsc.example.invalid',
      'WEB3_RPC_4663=https://robinhood.example.invalid',
      'WEB3_RPC_5042=https://arc.example.invalid',
      'WEB3_RPC_57073=https://ink.example.invalid',
      'ROUTING_API_KEY=synthetic-existing-key',
      'PARTNER_API_KEY=synthetic-partner-key',
      '#prod',
      'ROUTING_API_URL=https://routing-prod.example.invalid/',
      '#beta',
      '#ROUTING_API_URL=https://routing-beta.example.invalid/',
      '',
    ].join('\n')
    writeFileSync(join(directory, '.env'), configuration)
    try {
      const result = spawnSync('bash', [resolve(__dirname, '../../../../deploy.sh'), '-t', target], {
        cwd: directory,
        env: { PATH: `${bin}:/usr/bin:/bin`, RING_TEST_CALL_LOG: calls },
        encoding: 'utf8',
        timeout: 10000,
      })
      expect(result.status).toBe(0)
      const commands = readFileSync(calls, 'utf8').trim().split('\n')
      const deploys = commands.filter((command) => /^(cdk|npx cdk) deploy /.test(command))
      expect(deploys).toEqual([`npx cdk deploy RoutingAPIStack --profile ${profile}`])
      expect(commands.some((command) => command.includes(target === 'beta' ? 'ringprod' : 'tbbeta'))).toBe(false)
      const after = readFileSync(join(directory, '.env'), 'utf8')
      expect(after).toBe(configuration)
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
