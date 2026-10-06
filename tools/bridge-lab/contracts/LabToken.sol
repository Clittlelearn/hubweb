// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Collateral token for the local BSC-style bridge laboratory.
contract LabToken is ERC20 {
    constructor(address holder) ERC20("Bridge Lab Token", "HBR") {
        _mint(holder, 1000000 * 10 ** 8);
    }

    function decimals() public pure override returns (uint8) {
        return 8;
    }
}
