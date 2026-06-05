// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./AgentRegistry.sol";

contract CommitRevealCLOB is ReentrancyGuard, Ownable {

    // ─── Enums ─────────────────────────────────────────────────────────────

    enum Direction { BID, ASK }
    enum OrderStatus { COMMITTED, REVEALED, MATCHED, EXPIRED }

    // ─── Structs ───────────────────────────────────────────────────────────

    struct Order {
        address agent;
        bytes32 commitment;     // keccak256(price, amount, direction, salt)
        uint256 price;          // Precio en USDC (18 decimals)
        uint256 amount;         // Cantidad de tokenA (18 decimals)
        Direction direction;
        OrderStatus status;
        uint256 commitBlock;    // Bloque en que se hizo el commit
        uint256 revealBlock;    // Bloque en que se hizo el reveal
    }

    // ─── State ─────────────────────────────────────────────────────────────

    AgentRegistry public registry;
    IERC20 public tokenA;       // Token que se compra/vende (ej. WETH mock)
    IERC20 public tokenB;       // Token de pago (ej. USDC mock)

    mapping(uint256 => Order) public orders;
    uint256 public orderCount;

    uint256 public constant REVEAL_WINDOW = 5;       // Bloques para revelar
    uint256 public constant FEE_BPS       = 10;      // 0.10% fee
    uint256 public constant BPS_DENOMINATOR = 10000;

    // Orderbook simplificado: listas de IDs por dirección
    uint256[] public openBids;
    uint256[] public openAsks;

    // ─── Events ────────────────────────────────────────────────────────────

    event OrderCommitted(
        uint256 indexed orderId,
        address indexed agent,
        bytes32 commitment,
        uint256 blockNumber
    );

    event OrderRevealed(
        uint256 indexed orderId,
        address indexed agent,
        uint256 price,
        uint256 amount,
        Direction direction,
        uint256 blockNumber
    );

    event OrderMatched(
        uint256 indexed bidId,
        uint256 indexed askId,
        address indexed bidAgent,
        address askAgent,
        uint256 price,
        uint256 amount,
        uint256 fee
    );

    event OrderExpired(
        uint256 indexed orderId,
        address indexed agent,
        uint256 blockNumber
    );

    // ─── Constructor ───────────────────────────────────────────────────────

    constructor(
        address _registry,
        address _tokenA,
        address _tokenB
    ) Ownable(msg.sender) {
        registry = AgentRegistry(_registry);
        tokenA   = IERC20(_tokenA);
        tokenB   = IERC20(_tokenB);
    }

    // ─── Commit Phase ──────────────────────────────────────────────────────

    /// @notice Fase 1: el agente publica solo el hash de su orden
    /// @param commitment keccak256(abi.encodePacked(price, amount, direction, salt))
    function commitOrder(bytes32 commitment) external returns (uint256 orderId) {
        require(registry.isRegistered(msg.sender), "Agent not registered");

        orderId = ++orderCount;

        orders[orderId] = Order({
            agent:       msg.sender,
            commitment:  commitment,
            price:       0,
            amount:      0,
            direction:   Direction.BID,
            status:      OrderStatus.COMMITTED,
            commitBlock: block.number,
            revealBlock: 0
        });

        emit OrderCommitted(orderId, msg.sender, commitment, block.number);
    }

    // ─── Reveal Phase ──────────────────────────────────────────────────────

    /// @notice Fase 2: el agente revela los parámetros reales de su orden
    function revealOrder(
        uint256 orderId,
        uint256 price,
        uint256 amount,
        Direction direction,
        bytes32 salt
    ) external nonReentrant {
        Order storage order = orders[orderId];

        require(order.agent == msg.sender,                       "Not your order");
        require(order.status == OrderStatus.COMMITTED,           "Wrong status");
        require(block.number >= order.commitBlock + 1,           "Too early to reveal");
        require(block.number <= order.commitBlock + REVEAL_WINDOW, "Reveal window expired");
        require(price > 0 && amount > 0,                         "Invalid params");

        // Verificar que el hash coincide
        bytes32 expectedCommitment = keccak256(
            abi.encodePacked(price, amount, direction, salt)
        );
        require(order.commitment == expectedCommitment, "Commitment mismatch");

        // Actualizar orden
        order.price       = price;
        order.amount      = amount;
        order.direction   = direction;
        order.status      = OrderStatus.REVEALED;
        order.revealBlock = block.number;

        // Agregar al orderbook
        if (direction == Direction.BID) {
            openBids.push(orderId);
        } else {
            openAsks.push(orderId);
        }

        emit OrderRevealed(orderId, msg.sender, price, amount, direction, block.number);

        // Intentar matching inmediatamente
        _tryMatch();
    }

    // ─── Matching Engine ───────────────────────────────────────────────────

    /// @notice Intenta hacer match entre el mejor bid y el mejor ask
    /// Llamado por ReactivityAdapter via Somnia Reactivity también
    function matchOrders() external {
        _tryMatch();
    }

    function _tryMatch() internal {
        if (openBids.length == 0 || openAsks.length == 0) return;

        // Encontrar mejor bid (precio más alto) y mejor ask (precio más bajo)
        (uint256 bestBidIdx, uint256 bestBidId) = _findBestBid();
        (uint256 bestAskIdx, uint256 bestAskId) = _findBestAsk();

        if (bestBidId == 0 || bestAskId == 0) return;

        Order storage bid = orders[bestBidId];
        Order storage ask = orders[bestAskId];

        // Match solo si bid.price >= ask.price (spread cruzado)
        if (bid.price < ask.price) return;

        // Precio de ejecución = promedio
        uint256 execPrice  = (bid.price + ask.price) / 2;
        uint256 execAmount = bid.amount < ask.amount ? bid.amount : ask.amount;
        uint256 fee        = (execAmount * FEE_BPS) / BPS_DENOMINATOR;

        // Ejecutar settlement
        _settle(bid.agent, ask.agent, execPrice, execAmount, fee);

        // Actualizar estado de órdenes
        bid.status = OrderStatus.MATCHED;
        ask.status = OrderStatus.MATCHED;

        // Actualizar stats en el registry
        registry.updateStats(bid.agent, execAmount, fee / 2);
        registry.updateStats(ask.agent, execAmount, fee / 2);

        // Remover del orderbook
        _removeFromArray(openBids, bestBidIdx);
        _removeFromArray(openAsks, bestAskIdx);

        emit OrderMatched(
            bestBidId, bestAskId,
            bid.agent, ask.agent,
            execPrice, execAmount, fee
        );
    }

    // ─── Settlement ────────────────────────────────────────────────────────

    function _settle(
        address bidAgent,
        address askAgent,
        uint256 price,
        uint256 amount,
        uint256 fee
    ) internal {
        // bidAgent compra tokenA pagando tokenB
        // askAgent vende tokenA recibiendo tokenB
        uint256 totalCost = (price * amount) / 1e18;

        // bidAgent envía tokenB al askAgent
        require(
            tokenB.transferFrom(bidAgent, askAgent, totalCost - fee / 2),
            "TokenB transfer failed"
        );

        // askAgent envía tokenA al bidAgent
        require(
            tokenA.transferFrom(askAgent, bidAgent, amount - fee / 2),
            "TokenA transfer failed"
        );
    }

    // ─── Expire ────────────────────────────────────────────────────────────

    /// @notice Expirar órdenes que no fueron reveladas a tiempo
    /// Llamado por Cron Subscription de Somnia Reactivity
    function expireOrder(uint256 orderId) external {
        Order storage order = orders[orderId];
        require(order.status == OrderStatus.COMMITTED,              "Not committed");
        require(block.number > order.commitBlock + REVEAL_WINDOW,   "Window not closed");

        order.status = OrderStatus.EXPIRED;

        // Slash al agente por no revelar
        registry.slashAgent(order.agent, "Failed to reveal order in time");

        emit OrderExpired(orderId, order.agent, block.number);
    }

    // ─── Helpers ───────────────────────────────────────────────────────────

    function _findBestBid() internal view returns (uint256 idx, uint256 orderId) {
        uint256 bestPrice = 0;
        for (uint256 i = 0; i < openBids.length; i++) {
            Order storage o = orders[openBids[i]];
            if (o.status == OrderStatus.REVEALED && o.price > bestPrice) {
                bestPrice = o.price;
                idx       = i;
                orderId   = openBids[i];
            }
        }
    }

    function _findBestAsk() internal view returns (uint256 idx, uint256 orderId) {
        uint256 bestPrice = type(uint256).max;
        for (uint256 i = 0; i < openAsks.length; i++) {
            Order storage o = orders[openAsks[i]];
            if (o.status == OrderStatus.REVEALED && o.price < bestPrice) {
                bestPrice = o.price;
                idx       = i;
                orderId   = openAsks[i];
            }
        }
    }

    function _removeFromArray(uint256[] storage arr, uint256 idx) internal {
        arr[idx] = arr[arr.length - 1];
        arr.pop();
    }

    // ─── Views ─────────────────────────────────────────────────────────────

    function getOrder(uint256 orderId) external view returns (Order memory) {
        return orders[orderId];
    }

    function getOpenBids() external view returns (uint256[] memory) {
        return openBids;
    }

    function getOpenAsks() external view returns (uint256[] memory) {
        return openAsks;
    }

    /// @notice Helper para que el agente genere su commitment offchain
    function hashOrder(
        uint256 price,
        uint256 amount,
        Direction direction,
        bytes32 salt
    ) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(price, amount, direction, salt));
    }
}