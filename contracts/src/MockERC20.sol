// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockERC20 is ERC20, Ownable {
    uint8 private _decimals;

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimalsArg
    ) ERC20(name, symbol) Ownable(msg.sender) {
        _decimals = decimalsArg;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /// @notice Cualquiera puede mintear en testnet para desarrollo
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}