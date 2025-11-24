// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title GOLS Token - Token de performance tática do Guarani FC
/// @notice Mint controlado pelo owner (teu backend / carteira do clube)
contract GOLS {
    string public name = "GOLS Token";
    string public symbol = "GOLS";
    uint8 public decimals = 18;

    uint256 public totalSupply;

    address public owner;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ==== Ownership ====

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ==== ERC-20 Básico ====

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function allowance(address owner_, address spender) external view returns (uint256) {
        return _allowances[owner_][spender];
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 currentAllowance = _allowances[from][msg.sender];
        require(currentAllowance >= amount, "ERC20: transfer amount exceeds allowance");

        _transfer(from, to, amount);
        _approve(from, msg.sender, currentAllowance - amount);
        return true;
    }

    // ==== Mint / Burn (controlado) ====

    /// @notice Mint só pelo owner (teu backend / carteira do contrato)
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Mint to zero");

        totalSupply += amount;
        _balances[to] += amount;

        emit Transfer(address(0), to, amount);
    }

    /// @notice opcional: burn pelo owner (por segurança de reserva)
    function burn(address from, uint256 amount) external onlyOwner {
        require(from != address(0), "Burn from zero");
        require(_balances[from] >= amount, "Insufficient balance");

        _balances[from] -= amount;
        totalSupply -= amount;

        emit Transfer(from, address(0), amount);
    }

    // ==== Internals ====

    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "From zero");
        require(to != address(0), "To zero");
        require(_balances[from] >= amount, "Balance too low");

        _balances[from] -= amount;
        _balances[to] += amount;

        emit Transfer(from, to, amount);
    }

    function _approve(address owner_, address spender, uint256 amount) internal {
        require(owner_ != address(0), "Approve from zero");
        require(spender != address(0), "Approve to zero");

        _allowances[owner_][spender] = amount;
        emit Approval(owner_, spender, amount);
    }
}
