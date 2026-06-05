// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract AgentRegistry is Ownable, ReentrancyGuard {

    // ─── Structs ───────────────────────────────────────────────────────────

    struct Agent {
        bool registered;
        uint256 collateral;       // STT depositado como garantía
        uint256 ordersExecuted;   // Total de órdenes completadas
        uint256 totalVolume;      // Volumen total en USDC
        uint256 feesEarned;       // Fees acumulados
        uint256 slashCount;       // Veces penalizado por no revelar
        uint256 registeredAt;
    }

    // ─── State ─────────────────────────────────────────────────────────────

    mapping(address => Agent) public agents;
    address[] public agentList;

    uint256 public constant MIN_COLLATERAL = 0.01 ether; // 0.01 STT mínimo
    uint256 public constant SLASH_AMOUNT   = 0.001 ether; // Penalización por no reveal

    address public clobContract;  // Solo el CLOB puede llamar ciertas funciones

    // ─── Events ────────────────────────────────────────────────────────────

    event AgentRegistered(address indexed agent, uint256 collateral, uint256 timestamp);
    event CollateralDeposited(address indexed agent, uint256 amount);
    event CollateralWithdrawn(address indexed agent, uint256 amount);
    event AgentSlashed(address indexed agent, uint256 amount, string reason);
    event StatsUpdated(address indexed agent, uint256 ordersExecuted, uint256 feesEarned);

    // ─── Modifiers ─────────────────────────────────────────────────────────

    modifier onlyRegistered() {
        require(agents[msg.sender].registered, "Agent not registered");
        _;
    }

    modifier onlyCLOB() {
        require(msg.sender == clobContract, "Only CLOB can call this");
        _;
    }

    // ─── Constructor ───────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ─── Setup ─────────────────────────────────────────────────────────────

    function setCLOBContract(address _clob) external onlyOwner {
        clobContract = _clob;
    }

    // ─── Agent Management ──────────────────────────────────────────────────

    /// @notice Registrar un nuevo agente depositando colateral en STT
    function registerAgent() external payable {
        require(!agents[msg.sender].registered, "Already registered");
        require(msg.value >= MIN_COLLATERAL, "Insufficient collateral");

        agents[msg.sender] = Agent({
            registered:     true,
            collateral:     msg.value,
            ordersExecuted: 0,
            totalVolume:    0,
            feesEarned:     0,
            slashCount:     0,
            registeredAt:   block.timestamp
        });

        agentList.push(msg.sender);

        emit AgentRegistered(msg.sender, msg.value, block.timestamp);
    }

    /// @notice Depositar más colateral
    function depositCollateral() external payable onlyRegistered {
        agents[msg.sender].collateral += msg.value;
        emit CollateralDeposited(msg.sender, msg.value);
    }

    /// @notice Retirar colateral (solo si no tiene órdenes pendientes)
    function withdrawCollateral(uint256 amount) external nonReentrant onlyRegistered {
        require(agents[msg.sender].collateral >= amount, "Insufficient collateral");
        agents[msg.sender].collateral -= amount;
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "Transfer failed");
        emit CollateralWithdrawn(msg.sender, amount);
    }

    // ─── Called by CLOB ────────────────────────────────────────────────────

    /// @notice Penalizar agente por no revelar su orden a tiempo
    function slashAgent(address agent, string calldata reason) external onlyCLOB {
        require(agents[agent].registered, "Agent not registered");
        uint256 slash = SLASH_AMOUNT;
        if (agents[agent].collateral < slash) {
            slash = agents[agent].collateral;
        }
        agents[agent].collateral  -= slash;
        agents[agent].slashCount  += 1;
        emit AgentSlashed(agent, slash, reason);
    }

    /// @notice Actualizar stats después de un match exitoso
    function updateStats(
        address agent,
        uint256 volume,
        uint256 fee
    ) external onlyCLOB {
        agents[agent].ordersExecuted += 1;
        agents[agent].totalVolume    += volume;
        agents[agent].feesEarned     += fee;
        emit StatsUpdated(agent, agents[agent].ordersExecuted, agents[agent].feesEarned);
    }

    // ─── Views ─────────────────────────────────────────────────────────────

    function getAgent(address agent) external view returns (Agent memory) {
        return agents[agent];
    }

    function isRegistered(address agent) external view returns (bool) {
        return agents[agent].registered;
    }

    function getAgentCount() external view returns (uint256) {
        return agentList.length;
    }

    function getAllAgents() external view returns (address[] memory) {
        return agentList;
    }
}