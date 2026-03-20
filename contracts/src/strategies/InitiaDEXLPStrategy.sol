// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IStrategy} from "../interfaces/IStrategy.sol";

// ─── Uniswap V2 interfaces ───────────────────────────────────────────────────
// InitiaDEX on L1 is written in Move and cannot be called directly from Solidity.
// EVM Minitia runs a standard Uniswap V2-compatible AMM, so we use that interface.

interface IUniswapV2Router02 {
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity);

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB);

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

interface IUniswapV2Pair {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves()
        external
        view
        returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function totalSupply() external view returns (uint256);
}

// ─────────────────────────────────────────────────────────────────────────────

/// @title InitiaDEXLPStrategy
/// @notice Yield strategy that provides USDC/tokenB liquidity to a Uniswap V2-style
///         DEX on the EVM Minitia and earns trading-fee yield.
///
/// Flow on deposit:
///   1. Receive USDC from VaultManager.
///   2. Swap half to tokenB via the router.
///   3. Add liquidity — receive LP tokens.
///
/// Flow on withdraw:
///   1. Calculate the fraction of LP tokens corresponding to the requested USDC value.
///   2. Remove that liquidity.
///   3. Swap received tokenB back to USDC.
///   4. Transfer USDC to VaultManager.
///
/// APY and risk score are set by the owner (off-chain oracle / governance).
/// TVL is computed on-chain from actual LP reserves.
contract InitiaDEXLPStrategy is IStrategy, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IUniswapV2Router02 public immutable router;
    IUniswapV2Pair     public immutable pair;
    address            public immutable usdcToken;
    address            public immutable tokenB;
    address            public           vaultManager;

    /// @notice Estimated annual fee yield in basis points (owner-set).
    uint256 public configuredAPY;
    /// @notice Risk score 0–100 (owner-set; lower = safer).
    uint8   public configuredRiskScore;

    uint256 private constant DEADLINE_BUFFER = 5 minutes;

    // ─── Events & errors ─────────────────────────────────────────────────────

    event Deposited(uint256 usdcIn, uint256 lpReceived);
    event Withdrawn(uint256 lpRemoved, uint256 usdcReturned);
    event APYConfigured(uint256 apy);
    event RiskScoreConfigured(uint8 score);
    event VaultManagerUpdated(address indexed newVaultManager);

    error OnlyVaultManager();
    error PairTokenMismatch();

    // ─── Constructor ─────────────────────────────────────────────────────────

    /// @param _router           Address of the Uniswap V2 Router.
    /// @param _pair             Address of the USDC/tokenB pair contract.
    /// @param _usdcToken        USDC (base asset) address.
    /// @param _tokenB           Paired token address.
    /// @param _vaultManager     VaultManager that calls deposit/withdraw.
    /// @param _initialAPY       Initial APY estimate (bps).
    /// @param _initialRiskScore Initial risk score (0–100).
    /// @param initialOwner      Contract owner (deployer / multisig).
    constructor(
        address _router,
        address _pair,
        address _usdcToken,
        address _tokenB,
        address _vaultManager,
        uint256 _initialAPY,
        uint8   _initialRiskScore,
        address initialOwner
    ) Ownable(initialOwner) {
        // Sanity-check pair tokens
        address t0 = IUniswapV2Pair(_pair).token0();
        address t1 = IUniswapV2Pair(_pair).token1();
        bool validPair = (t0 == _usdcToken && t1 == _tokenB) || (t0 == _tokenB && t1 == _usdcToken);
        if (!validPair) revert PairTokenMismatch();

        router              = IUniswapV2Router02(_router);
        pair                = IUniswapV2Pair(_pair);
        usdcToken           = _usdcToken;
        tokenB              = _tokenB;
        vaultManager        = _vaultManager;
        configuredAPY       = _initialAPY;
        configuredRiskScore = _initialRiskScore;
    }

    modifier onlyVaultManager() {
        if (msg.sender != vaultManager) revert OnlyVaultManager();
        _;
    }

    // ─── IStrategy ───────────────────────────────────────────────────────────

    /// @inheritdoc IStrategy
    function deposit(uint256 amount) external override onlyVaultManager nonReentrant {
        IERC20(usdcToken).safeTransferFrom(vaultManager, address(this), amount);
        _addLiquidity(amount);
    }

    /// @inheritdoc IStrategy
    /// @dev The actual returned amount may differ from `amount` due to swap slippage.
    function withdraw(uint256 amount) external override onlyVaultManager nonReentrant returns (uint256 received) {
        uint256 tvl = getTVL();
        if (tvl == 0) return 0;

        uint256 lpBalance = IERC20(address(pair)).balanceOf(address(this));

        // Proportional LP to remove; if amount >= tvl, withdraw everything
        uint256 lpToRemove = amount >= tvl ? lpBalance : (lpBalance * amount) / tvl;
        if (lpToRemove == 0) return 0;

        received = _removeLiquidityAndSwap(lpToRemove);

        // Also sweep any idle USDC sitting on the contract (e.g. leftover from addLiquidity)
        uint256 idleUSDC = IERC20(usdcToken).balanceOf(address(this));
        if (idleUSDC > 0) received += idleUSDC;

        IERC20(usdcToken).safeTransfer(vaultManager, received);

        emit Withdrawn(lpToRemove, received);
    }

    /// @inheritdoc IStrategy
    function getAPY() external view override returns (uint256) {
        return configuredAPY;
    }

    /// @inheritdoc IStrategy
    /// @dev TVL = (our LP share of USDC reserves) + (our LP share of tokenB reserves valued in USDC)
    ///           + idle balances on this contract.
    function getTVL() public view override returns (uint256) {
        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();
        uint256 totalSupply = pair.totalSupply();

        address token0    = pair.token0();
        uint256 usdcRes   = token0 == usdcToken ? uint256(reserve0) : uint256(reserve1);
        uint256 tokenBRes = token0 == usdcToken ? uint256(reserve1) : uint256(reserve0);

        uint256 lpBalance = IERC20(address(pair)).balanceOf(address(this));
        uint256 lpValue;

        if (lpBalance > 0 && totalSupply > 0) {
            uint256 ourUSDC   = (lpBalance * usdcRes)   / totalSupply;
            uint256 ourTokenB = (lpBalance * tokenBRes) / totalSupply;

            // Convert our tokenB share to USDC using current reserve ratio
            uint256 tokenBInUSDC = tokenBRes > 0 ? (ourTokenB * usdcRes) / tokenBRes : 0;

            lpValue = ourUSDC + tokenBInUSDC;
        }

        // Include idle tokens sitting on this contract
        uint256 idleUSDC   = IERC20(usdcToken).balanceOf(address(this));
        uint256 idleTokenB = IERC20(tokenB).balanceOf(address(this));
        uint256 idleTokenBInUSDC = (tokenBRes > 0 && usdcRes > 0)
            ? (idleTokenB * usdcRes) / tokenBRes
            : 0;

        return lpValue + idleUSDC + idleTokenBInUSDC;
    }

    /// @inheritdoc IStrategy
    function getRiskScore() external view override returns (uint8) {
        return configuredRiskScore;
    }

    /// @inheritdoc IStrategy
    function asset() external view override returns (address) {
        return usdcToken;
    }

    // ─── Internal helpers ────────────────────────────────────────────────────

    /// @dev Swap half USDC → tokenB, then add liquidity. Leftover tokens stay idle.
    function _addLiquidity(uint256 usdcAmount) internal {
        uint256 half = usdcAmount / 2;
        if (half == 0) return;

        // Swap half USDC → tokenB
        address[] memory path = new address[](2);
        path[0] = usdcToken;
        path[1] = tokenB;

        IERC20(usdcToken).forceApprove(address(router), half);
        uint256[] memory amounts = router.swapExactTokensForTokens(
            half,
            0, // accept any; slippage is acceptable in demo
            path,
            address(this),
            block.timestamp + DEADLINE_BUFFER
        );
        uint256 tokenBReceived = amounts[1];

        // Add liquidity with remaining USDC + tokenB received
        uint256 remainingUSDC = usdcAmount - half;
        IERC20(usdcToken).forceApprove(address(router), remainingUSDC);
        IERC20(tokenB).forceApprove(address(router), tokenBReceived);

        (,, uint256 lpReceived) = router.addLiquidity(
            usdcToken,
            tokenB,
            remainingUSDC,
            tokenBReceived,
            0, // amountAMin
            0, // amountBMin
            address(this),
            block.timestamp + DEADLINE_BUFFER
        );

        emit Deposited(usdcAmount, lpReceived);
    }

    /// @dev Remove LP tokens and swap all tokenB back to USDC. Returns total USDC obtained.
    function _removeLiquidityAndSwap(uint256 lpAmount) internal returns (uint256 usdcOut) {
        IERC20(address(pair)).forceApprove(address(router), lpAmount);

        (uint256 amountUSDC, uint256 amountTokenB) = router.removeLiquidity(
            usdcToken,
            tokenB,
            lpAmount,
            0, // amountAMin
            0, // amountBMin
            address(this),
            block.timestamp + DEADLINE_BUFFER
        );

        if (amountTokenB > 0) {
            address[] memory path = new address[](2);
            path[0] = tokenB;
            path[1] = usdcToken;

            IERC20(tokenB).forceApprove(address(router), amountTokenB);
            uint256[] memory amounts = router.swapExactTokensForTokens(
                amountTokenB,
                0,
                path,
                address(this),
                block.timestamp + DEADLINE_BUFFER
            );
            amountUSDC += amounts[1];
        }

        return amountUSDC;
    }

    // ─── Owner setters ───────────────────────────────────────────────────────

    function setConfiguredAPY(uint256 apy) external onlyOwner {
        configuredAPY = apy;
        emit APYConfigured(apy);
    }

    function setConfiguredRiskScore(uint8 score) external onlyOwner {
        configuredRiskScore = score;
        emit RiskScoreConfigured(score);
    }

    function setVaultManager(address _vaultManager) external onlyOwner {
        require(_vaultManager != address(0), "Zero address");
        vaultManager = _vaultManager;
        emit VaultManagerUpdated(_vaultManager);
    }

    /// @notice Emergency token rescue (does not affect LP accounting).
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}
