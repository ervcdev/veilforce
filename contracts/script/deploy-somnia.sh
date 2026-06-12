#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
export $(grep -v '^#' .env | xargs)

GAS="--gas-limit 15000000 --legacy"
DEPLOYER=$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")

echo "Deployer: $DEPLOYER"
echo "Deploying to Somnia Testnet..."

echo "==> TokenA (WETH)"
TOKEN_A=$(forge create src/MockERC20.sol:MockERC20 \
  --rpc-url "$SOMNIA_RPC_URL" --private-key "$DEPLOYER_PRIVATE_KEY" \
  --constructor-args-path script/args/mockerc20.json $GAS --broadcast \
  | awk '/Deployed to:/ {print $3}')
echo "TokenA: $TOKEN_A"

echo "==> TokenB (USDC)"
TOKEN_B=$(forge create src/MockERC20.sol:MockERC20 \
  --rpc-url "$SOMNIA_RPC_URL" --private-key "$DEPLOYER_PRIVATE_KEY" \
  --constructor-args-path script/args/mockerc20-usdc.json $GAS --broadcast \
  | awk '/Deployed to:/ {print $3}')
echo "TokenB: $TOKEN_B"

echo "==> AgentRegistry"
REGISTRY=$(forge create src/AgentRegistry.sol:AgentRegistry \
  --rpc-url "$SOMNIA_RPC_URL" --private-key "$DEPLOYER_PRIVATE_KEY" \
  $GAS --broadcast | awk '/Deployed to:/ {print $3}')
echo "Registry: $REGISTRY"

echo "==> CommitRevealCLOB"
CLOB=$(forge create src/CommitRevealCLOB.sol:CommitRevealCLOB \
  --rpc-url "$SOMNIA_RPC_URL" --private-key "$DEPLOYER_PRIVATE_KEY" \
  --constructor-args "$REGISTRY" "$TOKEN_A" "$TOKEN_B" \
  $GAS --broadcast | awk '/Deployed to:/ {print $3}')
echo "CLOB: $CLOB"

echo "==> setCLOBContract"
cast send "$REGISTRY" "setCLOBContract(address)" "$CLOB" \
  --rpc-url "$SOMNIA_RPC_URL" --private-key "$DEPLOYER_PRIVATE_KEY" $GAS

echo "==> setFeeRecipient"
cast send "$CLOB" "setFeeRecipient(address)" "$DEPLOYER" \
  --rpc-url "$SOMNIA_RPC_URL" --private-key "$DEPLOYER_PRIVATE_KEY" $GAS

echo "==> ReactivityAdapter"
ADAPTER=$(forge create src/ReactivityAdapter.sol:ReactivityAdapter \
  --rpc-url "$SOMNIA_RPC_URL" --private-key "$DEPLOYER_PRIVATE_KEY" \
  --constructor-args "$CLOB" "0x0000000000000000000000000000000000000100" \
  $GAS --broadcast | awk '/Deployed to:/ {print $3}')
echo "Adapter: $ADAPTER"

echo "==> setKeeper"
cast send "$CLOB" "setKeeper(address)" "$ADAPTER" \
  --rpc-url "$SOMNIA_RPC_URL" --private-key "$DEPLOYER_PRIVATE_KEY" $GAS

MINT_AMOUNT="10000000000000000000000" # 10_000 * 1e18
for AGENT in "$AGENT_1_ADDRESS" "$AGENT_2_ADDRESS" "$AGENT_3_ADDRESS"; do
  echo "==> Mint to $AGENT"
  cast send "$TOKEN_A" "mint(address,uint256)" "$AGENT" "$MINT_AMOUNT" \
    --rpc-url "$SOMNIA_RPC_URL" --private-key "$DEPLOYER_PRIVATE_KEY" $GAS
  cast send "$TOKEN_B" "mint(address,uint256)" "$AGENT" "$MINT_AMOUNT" \
    --rpc-url "$SOMNIA_RPC_URL" --private-key "$DEPLOYER_PRIVATE_KEY" $GAS
done

cat <<EOF

============================== DEPLOY COMPLETE ==============================
COMMIT_REVEAL_CLOB_ADDRESS=$CLOB
AGENT_REGISTRY_ADDRESS=$REGISTRY
REACTIVITY_ADAPTER_ADDRESS=$ADAPTER
TOKEN_A_ADDRESS=$TOKEN_A
TOKEN_B_ADDRESS=$TOKEN_B
=============================================================================

EOF
