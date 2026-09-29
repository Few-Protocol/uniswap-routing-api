# Arc and Ink API beta deployment

Deploy these candidates to testring first. Production release is a separate decision after the acceptance checks below.

| Service | Review | Base | Beta target |
| --- | --- | --- | --- |
| Routing | [PR #29](https://github.com/Few-Protocol/uniswap-routing-api/pull/29) | `ring_main` | `RoutingAPIStack`, AWS profile `tbbeta` |
| Unified | [PR #42](https://github.com/Few-Protocol/unified-routing-api/pull/42) | `ring_main` | `UnifiedRoutingStack`, AWS profile `tbbeta` |
| GraphQL | [PR #68](https://github.com/Few-Protocol/ring-api-graphql/pull/68) | `main` | Railway service `ring-api-beta`, domain `rw.testring.org` |

## Before deployment

1. Review and check out each PR's latest commit using the team's existing deployment checkout. Record `git rev-parse HEAD`. Preserve the complete local deployment environment when switching branches; do not replace it with an example file or an environment containing only the new networks.
2. Use each repository's documented Node/package-manager setup. Verify the pinned dependencies and tests before deploying. These PRs consume SOR `0.6.1`; no new npm release is required.
3. Confirm both new RPCs respond with the expected chain IDs: Arc `5042`, Ink `57073`. Keep every existing RPC, API key and service variable unchanged. Add the following values only in the deployment environment:

| Service | Arc | Ink |
| --- | --- | --- |
| Routing | `WEB3_RPC_5042` | `WEB3_RPC_57073` |
| Unified | `RPC_5042` | `RPC_57073` |
| GraphQL | `JSON_RPC_PROVIDER_ARC` | `JSON_RPC_PROVIDER_INK` |

GraphQL also retains its existing shared Alchemy-key fallback. An enabled network needs a working dedicated RPC or a working fallback. Configure both networks because both are enabled by these PRs.

4. Record the current beta deployment revisions and a small baseline of successful quotes on BSC, Base, Arbitrum, Hyper and Robinhood. Retain the current API key and Unified beta Routing endpoint.
5. Confirm the AWS profile before either CDK deployment:

```sh
aws sts get-caller-identity --profile tbbeta
```

Match the returned account to the team's beta account. `ringprod` is a different account and is outside this procedure.

## Deploy in order

In the Routing candidate checkout:

```sh
./deploy.sh -t beta
```

Confirm the deployed quote Lambdas have the new RPC entries and retain every existing RPC entry, without logging their values. Run a direct Routing quote before proceeding.

In the Unified candidate checkout, retain the existing Routing API key and ensure the script's beta `ROUTING_API_URL` points to that beta Routing service:

```sh
./deploy.sh -t beta
```

Both scripts deploy the **current checkout**. The branch name printed by the scripts does not check out that branch. Review the proposed CDK changes before accepting them; this release should not remove existing chains or replace unrelated resources.

For GraphQL, configure the new RPC variables on **`ring-api-beta`** and deploy the reviewed commit through the existing `main` deployment workflow after review/merge approval. Check the active deployment commit and `rw.testring.org` health. Do not change `ring-api-prod` or `main_prod`. The Railway environment label alone is insufficient: both services may be grouped under an environment named `production`.

## Acceptance on testring

- Arc token search/list: USDC at `0x3600000000000000000000000000000000000000` and EURC at `0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1`, both 6 decimals. Use these ERC-20 tokens for swaps. Arc's native USDC balance has 18 decimals and pays gas; native-token swap requests are rejected because this integration has no wrapped-native contract.
- Quote USDC → EURC and EURC → USDC with exact-input and exact-output. Test V2, V3 and V4 separately, then the normal combined protocol request. A missing mixed route alone is not a failure; a request error or a missing supported single-protocol route needs investigation.
- Check the response amount, chain, protocol, router and calldata. Arc must select Universal Router `2.1.1` at `0x4fca4a51ab4f23a7447b3284fbd7d73289a89fb1`; ERC-20 swaps must send native `value = 0`.
- Check GraphQL token selection, balances, approvals and gas estimates through the frontend. Run transaction execution only on a disposable Arc-compatible fork, which preserves native/ERC-20 shared-balance semantics. Do not use a normal Ethereum fork to validate those semantics or send real trades for acceptance.
- Check first-request and consecutive-request behavior. Repeat the baseline quotes and transaction-parameter checks on BSC, Base, Arbitrum, Hyper and Robinhood; smoke-test Ink as another newly enabled network.

The local regression suite checks configuration forwarding, deployment target selection and transaction encoding. It does not replace these deployed API/frontend checks. Record deployed commit IDs and results before production approval.

## Stop and rollback

If an existing network loses quotes, an old RPC/key changes, the target account is wrong, or calldata selects an unexpected router, stop the rollout. Restore the last known-good **beta** deployment and its complete environment using the existing AWS/Railway rollback procedure, then re-run baseline checks. Leave production unchanged.
