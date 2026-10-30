#!/usr/bin/env bash
# Northline Split mainnet launch (Arc, chain 5042).
#   dry run (default, nothing is sent):   scripts/mainnet-launch.sh
#   broadcast (real USDC, needs approval): CONFIRM=broadcast scripts/mainnet-launch.sh
# Requires Arc Foundry (arc-forge / arc-cast in ~/.local/bin): https://docs.arc.io/arc/tutorials/install-arc-foundry
# Keys are read from SECRETS (outside this repo) and never printed.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/bin:$PATH"
RPC=https://rpc.mainnet.arc.io
MAIN=0xFe5D81D8268CBaC025829CEdD11D5cF6962d4096
REVENUE=0xD4F04c07037c42F84e5B15A7843e58e1C6FccC96
SECRETS="${SECRETS:-/workspace/earn-5900/agent-run/secrets/crypto-wallets.json}"
[ "$(arc-cast chain-id --rpc-url $RPC)" = 5042 ] || { echo "RPC is not Arc mainnet"; exit 1; }
echo "MAIN    $(arc-cast balance $MAIN --rpc-url $RPC --ether) USDC"
echo "REVENUE $(arc-cast balance $REVENUE --rpc-url $RPC --ether) USDC"
if [ "${CONFIRM:-}" != broadcast ]; then
  arc-forge script contracts/script/MainnetLaunch.s.sol --rpc-url $RPC --sender $MAIN
  echo "Dry run only. Nothing was sent."
  exit 0
fi
KEY="$(python3 -c 'import json,sys;k=json.load(open(sys.argv[1]))["evm"]["private_key"];print(k if k.startswith("0x") else "0x"+k)' "$SECRETS")"
[ "$(arc-cast wallet address --private-key "$KEY")" = "$MAIN" ] || { echo "key does not match MAIN"; exit 1; }
arc-forge script contracts/script/MainnetLaunch.s.sol --rpc-url $RPC --private-key "$KEY" --broadcast --slow
unset KEY
VAULT=$(python3 -c 'import json;print(json.load(open("broadcast/MainnetLaunch.s.sol/5042/run-latest.json"))["receipts"][0]["contractAddress"])')
# Revenue payee (main mnemonic, index 1) pulls its 40% share.
RKEY="$(python3 - "$SECRETS" <<'PY'
import json,sys
from eth_account import Account
Account.enable_unaudited_hdwallet_features()
m=json.load(open(sys.argv[1]))["evm"]["mnemonic"]
print(Account.from_mnemonic(m, account_path="m/44'/60'/0'/0/1").key.hex())
PY
)"
case "$RKEY" in 0x*) ;; *) RKEY="0x$RKEY";; esac
[ "$(arc-cast wallet address --private-key "$RKEY")" = "$REVENUE" ] || { echo "index-1 key does not match REVENUE"; exit 1; }
arc-cast send "$VAULT" "release()" --rpc-url $RPC --private-key "$RKEY" --json | python3 -c 'import json,sys;r=json.load(sys.stdin);print("revenue release",r["transactionHash"],r["status"])'
unset RKEY
echo "{\"network\":\"mainnet\",\"chainId\":5042,\"address\":\"$VAULT\"}" > deployments-mainnet.json
echo "Vault: https://explorer.arc.io/address/$VAULT"
echo "App:   https://northline-split.pages.dev/?split=$VAULT"
