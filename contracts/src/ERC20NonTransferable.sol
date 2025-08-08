// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.25;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ERC20NonTransferable is
    ERC20VotesUpgradeable,
    ERC20PausableUpgradeable,
    ERC20BurnableUpgradeable,
    Ownable2StepUpgradeable
{
    using SafeERC20 for IERC20;

    error ERC20IsNonTransferable();

    /**
     * @notice Initialize
     */
    function initialize(address treasury) external initializer {
        // Initialize ERC20
        __ERC20_init("Test", "TEST");

        // Initialize ERC20Votes
        __ERC20Votes_init();

        // Initialize Burnable
        __ERC20Burnable_init();

        // Initialize Pausable
        __ERC20Pausable_init();

        // Initialize Ownable
        __Ownable_init(treasury);

        // Mint Total Supply in the treasury
        _mint(0xADC81e65845cEca5B928fdd484A38B98E5f418B0, 100_000_000_000e18);
    }

    /**
     * @param from Sender address
     * @param to Receiver address
     * @param value Value to transfer
     * @dev In a future upgrade if the token becomes transferable all restrictions will be removed
     */
    function _update(
        address from,
        address to,
        uint256 value
    )
        internal
        virtual
        override(
            ERC20Upgradeable,
            ERC20VotesUpgradeable,
            ERC20PausableUpgradeable
        )
        whenNotPaused
    {
        if (from != address(0)) revert ERC20IsNonTransferable();
        super._update(from, to, value);
    }

    uint256[50] private __gap; // reserve space for upgradeability storage slot
}