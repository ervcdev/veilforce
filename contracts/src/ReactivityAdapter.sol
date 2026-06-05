// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./CommitRevealCLOB.sol";

/// @notice Adaptador que recibe callbacks de Somnia Reactivity
/// y dispara el matching automáticamente
contract ReactivityAdapter {

    // Dirección del Reactivity Precompile de Somnia
    // Verificar en: https://docs.somnia.network/developer/reactivity/what-is-reactivity
    address public constant REACTIVITY_PRECOMPILE = address(0x0100);

    CommitRevealCLOB public clob;
    address public owner;

    event ReactivityTriggered(bytes32 indexed eventId, uint256 blockNumber);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyReactivity() {
        require(
            msg.sender == REACTIVITY_PRECOMPILE,
            "Only Somnia Reactivity can call this"
        );
        _;
    }

    constructor(address _clob) {
        clob  = CommitRevealCLOB(_clob);
        owner = msg.sender;
    }

    /// @notice Callback llamado por Somnia Reactivity cuando
    /// se emite el evento OrderRevealed en CommitRevealCLOB
    function handleOrderRevealed(bytes calldata eventData) external onlyReactivity {
        // Decodificar el orderId del evento
        (uint256 orderId,,,,) = abi.decode(
            eventData,
            (uint256, address, uint256, uint256, uint8)
        );

        emit ReactivityTriggered(bytes32(orderId), block.number);

        // Disparar matching en el mismo bloque
        clob.matchOrders();
    }

    /// @notice Fallback para cuando Reactivity pasa datos adicionales
    function handleEvent(bytes calldata eventData) external onlyReactivity {
        clob.matchOrders();
    }

    /// @notice Registrar la suscripción a Somnia Reactivity
    /// Ver: https://docs.somnia.network/developer/reactivity/tooling/subscription-management
    /// Esto se hace via SDK después del deploy, no desde el contrato
    function getSubscriptionInfo() external view returns (
        address watchedContract,
        bytes32 watchedEventSig,
        address callbackContract,
        bytes4 callbackSelector
    ) {
        return (
            address(clob),
            keccak256("OrderRevealed(uint256,address,uint256,uint256,uint8,uint256)"),
            address(this),
            this.handleOrderRevealed.selector
        );
    }
}