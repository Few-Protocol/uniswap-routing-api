import { describe, expect, it } from '@jest/globals'
import {
  buildSusdrReadinessReport,
  getSusdrRpcUrl,
  parseSusdrLiquiditySourceConfigs,
  parseSusdrV2PoolConfigs,
} from '../../../../lib/susdr'

describe('sUSDR config', () => {
  it('returns no V2 pools when env is empty', () => {
    expect(parseSusdrV2PoolConfigs(undefined)).toEqual([])
  })

  it('treats accidental undefined-string config as empty', () => {
    expect(parseSusdrV2PoolConfigs('undefined')).toEqual([])
    expect(parseSusdrLiquiditySourceConfigs('undefined')).toEqual([])
  })

  it('parses V2 pool configs from JSON', () => {
    const configs = parseSusdrV2PoolConfigs(
      JSON.stringify([
        {
          poolAddress: '0x0000000000000000000000000000000000000001',
          label: 'USDR/USDC',
          teamAddresses: ['0x0000000000000000000000000000000000000002'],
          usableTeamLpBps: 2_000,
        },
      ])
    )

    expect(configs).toEqual([
      {
        poolAddress: '0x0000000000000000000000000000000000000001',
        label: 'USDR/USDC',
        capacityMode: 'team-lp',
        teamAddresses: ['0x0000000000000000000000000000000000000002'],
        usableTeamLpBps: 2_000,
        maxSlippageBps: 50,
      },
    ])
  })

  it('parses full-reserve V2 pool configs without team LP addresses', () => {
    const configs = parseSusdrV2PoolConfigs(
      JSON.stringify([
        {
          poolAddress: '0x0000000000000000000000000000000000000001',
          label: 'fwWETH/fwUSDC',
          capacityMode: 'full-reserve',
          maxSlippageBps: 50,
        },
      ])
    )

    expect(configs).toEqual([
      {
        poolAddress: '0x0000000000000000000000000000000000000001',
        label: 'fwWETH/fwUSDC',
        capacityMode: 'full-reserve',
        teamAddresses: [],
        usableTeamLpBps: 10_000,
        maxSlippageBps: 50,
      },
    ])
  })

  it('rejects unsafe V2 pool config values', () => {
    expect(() =>
      parseSusdrV2PoolConfigs(
        JSON.stringify([
          {
            poolAddress: '0x0000000000000000000000000000000000000001',
            teamAddresses: ['0x0000000000000000000000000000000000000002'],
            usableTeamLpBps: 10_001,
          },
        ])
      )
    ).toThrow('Invalid usableTeamLpBps')
  })

  it('picks the chain-specific sUSDR RPC URL first', () => {
    expect(
      getSusdrRpcUrl(1, {
        SUSDR_RPC_URL_1: 'https://susdr-mainnet.example',
        WEB3_RPC_1: 'https://web3-mainnet.example',
        SUSDR_RPC_URL: 'https://susdr-default.example',
      })
    ).toEqual('https://susdr-mainnet.example')
  })

  it('parses read-only liquidity source configs', () => {
    const configs = parseSusdrLiquiditySourceConfigs(
      JSON.stringify([
        {
          id: 'idle-usdr',
          kind: 'idle-usdr',
          label: 'Vault USDR',
          readType: 'erc20-balance',
          decimals: 18,
          tokenAddress: '0x0000000000000000000000000000000000000001',
          holderAddress: '0x0000000000000000000000000000000000000002',
        },
        {
          id: 'aave-usdc',
          kind: 'aave-usdc',
          label: 'Aave USDC',
          readType: 'aave-max-withdraw',
          decimals: 6,
          tokenAddress: '0x0000000000000000000000000000000000000005',
          aTokenAddress: '0x0000000000000000000000000000000000000003',
          ownerAddress: '0x0000000000000000000000000000000000000004',
        },
      ])
    )

    expect(configs.map((config) => config.id)).toEqual(['idle-usdr', 'aave-usdc'])
    expect(configs.map((config) => config.readType)).toEqual(['erc20-balance', 'aave-max-withdraw'])
  })

  it('reports missing live config for strict launch', () => {
    const report = buildSusdrReadinessReport({
      chainId: 1,
      env: {},
      liquiditySourceConfigs: [],
      nowMs: 1_780_000_000_000,
      v2PoolConfigs: [],
    })

    expect(report.strictReady).toEqual(false)
    expect(report.liveConfigReady).toEqual(false)
    expect(report.missing).toEqual([
      'Missing SUSDR_RPC_URL_1, WEB3_RPC_1, or SUSDR_RPC_URL',
      'Missing SUSDR_LIQUIDITY_SOURCES_JSON: vault / holder / Aave owner addresses',
      'Missing SUSDR_V2_POOLS_JSON: pool address / capacity mode',
    ])
  })

  it('reports strict-ready when RPC, liquidity sources, and pools are configured', () => {
    const liquiditySourceConfigs = parseSusdrLiquiditySourceConfigs(
      JSON.stringify([
        {
          id: 'idle-usdr',
          kind: 'idle-usdr',
          label: 'Vault USDR',
          readType: 'erc20-balance',
          decimals: 18,
          tokenAddress: '0x0000000000000000000000000000000000000001',
          holderAddress: '0x0000000000000000000000000000000000000002',
        },
      ])
    )
    const v2PoolConfigs = parseSusdrV2PoolConfigs(
      JSON.stringify([
        {
          poolAddress: '0x0000000000000000000000000000000000000003',
          capacityMode: 'team-lp',
          teamAddresses: ['0x0000000000000000000000000000000000000004'],
          usableTeamLpBps: 1_000,
        },
      ])
    )

    const report = buildSusdrReadinessReport({
      chainId: 1,
      env: { SUSDR_RPC_URL_1: 'https://mainnet.example' },
      liquiditySourceConfigs,
      v2PoolConfigs,
    })

    expect(report.strictReady).toEqual(true)
    expect(report.liveConfigReady).toEqual(true)
    expect(report.missing).toEqual([])
  })
})
