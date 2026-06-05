// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/MockERC20.sol";
import "../src/AgentRegistry.sol";
import "../src/CommitRevealCLOB.sol";
import "../src/ReactivityAdapter.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // 1. Deploy tokens mock
        MockERC20 tokenA = new MockERC20("Wrapped ETH Mock", "WETH", 18);
        MockERC20 tokenB = new MockERC20("USD Coin Mock",    "USDC", 6);

        console.log("TokenA (WETH) deployed:", address(tokenA));
        console.log("TokenB (USDC) deployed:", address(tokenB));

        // 2. Deploy AgentRegistry
        AgentRegistry registry = new AgentRegistry();
        console.log("AgentRegistry deployed:", address(registry));

        // 3. Deploy CommitRevealCLOB
        CommitRevealCLOB clob = new CommitRevealCLOB(
            address(registry),
            address(tokenA),
            address(tokenB)
        );
        console.log("CommitRevealCLOB deployed:", address(clob));

        // 4. Conectar registry con clob
        registry.setCLOBContract(address(clob));
        console.log("Registry connected to CLOB");

        // 5. Deploy ReactivityAdapter
        ReactivityAdapter adapter = new ReactivityAdapter(address(clob));
        console.log("ReactivityAdapter deployed:", address(adapter));

        // 6. Mintear tokens a las wallets de los agentes para testing
        // Ajustar estas direcciones con las wallets reales de tus agentes
        address agent1 = vm.envAddress("AGENT_1_ADDRESS");
        address agent2 = vm.envAddress("AGENT_2_ADDRESS");
        address agent3 = vm.envAddress("AGENT_3_ADDRESS");

        uint256 mintAmount = 10_000 * 1e18; // 10,000 tokens cada uno

        tokenA.mint(agent1, mintAmount);
        tokenA.mint(agent2, mintAmount);
        tokenA.mint(agent3, mintAmount);
        tokenB.mint(agent1, mintAmount);
        tokenB.mint(agent2, mintAmount);
        tokenB.mint(agent3, mintAmount);

        console.log("Tokens minted to agents");

        vm.stopBroadcast();

        // Imprimir resumen para copiar al .env
        console.log("\n=== COPY TO .env ===");
        console.log("COMMIT_REVEAL_CLOB_ADDRESS=", address(clob));
        console.log("AGENT_REGISTRY_ADDRESS=",     address(registry));
        console.log("REACTIVITY_ADAPTER_ADDRESS=", address(adapter));
        console.log("TOKEN_A_ADDRESS=",            address(tokenA));
        console.log("TOKEN_B_ADDRESS=",            address(tokenB));
    }
}