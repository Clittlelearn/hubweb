// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract BridgeTestToken is ERC20 {
    uint8 private immutable tokenDecimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_, address holder, uint256 supply)
        ERC20(name_, symbol_)
    {
        require(decimals_ <= 18, "Unsupported decimals");
        tokenDecimals = decimals_;
        _mint(holder, supply);
    }

    function decimals() public view override returns (uint8) {
        return tokenDecimals;
    }
}
