#!/usr/bin/env bash
# Enlaza AgentRegistry → CommitRevealCLOB (paso omitido en el deploy original).
# Requiere: contracts/.env con DEPLOYER_PRIVATE_KEY, AGENT_REGISTRY_ADDRESS, COMMIT_REVEAL_CLOB_ADDRESS
set -euo pipefail

cd "$(dirname "$0")/.."
export $(grep -v '^#' .env | xargs)

REGISTRY="${AGENT_REGISTRY_ADDRESS:?AGENT_REGISTRY_ADDRESS missing}"
CLOB="${COMMIT_REVEAL_CLOB_ADDRESS:?COMMIT_REVEAL_CLOB_ADDRESS missing}"
GAS="--gas-limit 15000000 --legacy"

CURRENT=$(cast call "$REGISTRY" "clobContract()(address)" --rpc-url "$SOMNIA_RPC_URL")
echo "Registry:  $REGISTRY"
echo "CLOB:      $CLOB"
echo "Actual:    $CURRENT"

if [ "$(echo "$CURRENT" | tr '[:upper:]' '[:lower:]')" = "$(echo "$CLOB" | tr '[:upper:]' '[:lower:]')" ]; then
  echo "✓ Ya enlazado — nada que hacer."
  exit 0
fi

echo "==> setCLOBContract($CLOB)"
cast send "$REGISTRY" "setCLOBContract(address)" "$CLOB" \
  --rpc-url "$SOMNIA_RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  $GAS

NEW=$(cast call "$REGISTRY" "clobContract()(address)" --rpc-url "$SOMNIA_RPC_URL")
echo "✓ clobContract() = $NEW"
