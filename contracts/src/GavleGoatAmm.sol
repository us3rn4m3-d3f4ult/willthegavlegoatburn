// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address who) external view returns (uint256);
}

/**
 * @title GavleGoatAmm
 * @notice Binary prediction market with a constant-product AMM. Starts at 50/50
 *         and the price moves on every buy and sell, with nobody posting orders.
 *
 * Why constant product and not LMSR: LMSR needs exp/ln in fixed point, which is
 * where hand-rolled implementations quietly lose money. This uses multiplication,
 * division and one square root, and the invariant is asserted in every test.
 *
 * Pool: `yesReserve * noReserve = k`. Price of YES = noReserve / (yes + no).
 * Equal reserves = 50%.
 *
 * Liquidity is seeded ONCE by whoever calls `seed()`. That seeder is the
 * counterparty to every trade and carries the risk — there is no protocol fee,
 * so their only return is the position they hold at resolution.
 *
 * Invariant: usdc.balanceOf(this) == credited + totalYes, always.
 * Every buy mints `amount` YES + `amount` NO against `amount` USDC, so
 * totalYes == totalNo == collateral held for the market.
 */
contract GavleGoatAmm {
    enum Status {
        Trading,
        Closed,
        Resolved,
        Voided
    }

    IERC20 public immutable usdc;
    address public immutable resolver;
    uint64 public immutable bettingClosesAt;
    uint64 public immutable resolutionDeadline;
    uint64 public immutable voidAfter;
    uint256 public constant TIMELOCK = 72 hours;

    Status public status;
    bool public resolvedYes;
    uint64 public proposedAt;
    bytes32 public evidenceHash;

    uint256 public yesReserve;
    uint256 public noReserve;
    address public seeder;

    mapping(address => uint256) public yesBalance;
    mapping(address => uint256) public noBalance;
    mapping(address => uint256) public usdcBalance;

    uint256 public totalYes;
    uint256 public totalNo;
    uint256 public credited;

    event Seeded(address indexed by, uint256 amount);
    event Bought(address indexed by, bool yes, uint256 usdcIn, uint256 sharesOut);
    event Sold(address indexed by, bool yes, uint256 sharesIn, uint256 usdcOut);
    event Deposited(address indexed by, uint256 amount);
    event Withdrawn(address indexed by, uint256 amount);
    event ResolutionProposed(bool yesWon, bytes32 evidence, uint64 finalizesAt);
    event ResolutionFinalized(bool yesWon);
    event MarketVoided();
    event Redeemed(address indexed by, uint256 shares, uint256 usdcOut);

    error NotTrading();
    error BadState();
    error NotResolver();
    error NoLiquidity();
    error AlreadySeeded();
    error Slippage();
    error Insufficient();
    error TimelockActive();
    error TooEarly();
    error NothingToDo();
    error TransferFailed();

    constructor(IERC20 usdc_, address resolver_, uint64 closes_, uint64 deadline_) {
        require(address(usdc_) != address(0) && resolver_ != address(0), "args");
        require(closes_ > block.timestamp && deadline_ > closes_, "times");
        usdc = usdc_;
        resolver = resolver_;
        bettingClosesAt = closes_;
        resolutionDeadline = deadline_;
        voidAfter = deadline_ + 30 days;
    }

    // ── liquidity ───────────────────────────────────────────────────────────

    function seed(uint256 amount) external {
        if (seeder != address(0)) revert AlreadySeeded();
        if (amount == 0) revert NothingToDo();
        if (status != Status.Trading || block.timestamp >= bettingClosesAt) revert NotTrading();

        seeder = msg.sender;
        yesReserve = amount;
        noReserve = amount;
        totalYes = amount;
        totalNo = amount;

        if (!usdc.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        emit Seeded(msg.sender, amount);
    }

    // ── pricing ─────────────────────────────────────────────────────────────

    /// @notice Implied probability of YES, 1e18 scale.
    function yesPrice() public view returns (uint256) {
        uint256 total = yesReserve + noReserve;
        if (total == 0) return 0.5e18;
        return (noReserve * 1e18) / total;
    }

    function isTrading() public view returns (bool) {
        return
            status == Status.Trading && block.timestamp < bettingClosesAt && seeder != address(0);
    }

    /// @notice Shares received for `amount` USDC. Pairs are minted into the pool
    ///         first, then the pool releases shares while holding k constant.
    ///
    /// Computed as one division so the result floors: `y1 - k/n1` would round the
    /// shares *up* (because k/n1 floors), handing the trader a wei for free on
    /// every round trip. Found by the fuzz test.
    function quoteBuy(bool yes, uint256 amount) public view returns (uint256 sharesOut) {
        if (seeder == address(0) || amount == 0) return 0;
        uint256 k = yesReserve * noReserve;
        uint256 y1 = yesReserve + amount;
        uint256 n1 = noReserve + amount;
        uint256 numerator = y1 * n1 - k;
        sharesOut = yes ? numerator / n1 : numerator / y1;
    }

    /**
     * @notice USDC received for selling `shares` back into the pool.
     *
     * The seller's shares return to the pool, then `m` complete pairs are merged
     * back into collateral so that the remaining reserves still satisfy
     * `(y + s - m)(n - m) = k`. That expands to
     *
     *     m^2 - m(y + s + n) + s*n = 0
     *
     * and we take the smaller root.
     */
    function quoteSell(bool yes, uint256 shares) public view returns (uint256 usdcOut) {
        if (seeder == address(0) || shares == 0) return 0;

        uint256 y = yesReserve;
        uint256 n = noReserve;
        uint256 s = shares;
        // Cannot merge more pairs than exist on the opposite side.
        if (yes && s > n) s = n;
        if (!yes && s > y) s = y;
        if (s == 0) return 0;

        uint256 b = y + s + n;
        uint256 disc = b * b - 4 * s * (yes ? n : y);
        // Round the root UP so `m` rounds down: the trader must never receive the
        // extra wei that a floored root would hand them.
        uint256 root = _sqrt(disc);
        if (root * root < disc) root += 1;
        uint256 m = (b - root) / 2;

        usdcOut = m > s ? s : m;
    }

    function _sqrt(uint256 x) private pure returns (uint256 z) {
        if (x == 0) return 0;
        z = x;
        uint256 y = (x + 1) / 2;
        while (y < z) {
            z = y;
            y = (x / y + y) / 2;
        }
    }

    // ── trading ─────────────────────────────────────────────────────────────

    function buy(
        bool yes,
        uint256 amount,
        uint256 minSharesOut
    ) external returns (uint256 sharesOut) {
        if (!isTrading()) revert NotTrading();
        if (amount == 0) revert NothingToDo();

        sharesOut = quoteBuy(yes, amount);
        if (sharesOut == 0) revert NoLiquidity();
        if (sharesOut < minSharesOut) revert Slippage();

        yesReserve += amount;
        noReserve += amount;
        if (yes) yesReserve -= sharesOut;
        else noReserve -= sharesOut;
        totalYes += amount;
        totalNo += amount;

        if (!usdc.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        if (yes) yesBalance[msg.sender] += sharesOut;
        else noBalance[msg.sender] += sharesOut;

        emit Bought(msg.sender, yes, amount, sharesOut);
    }

    function sell(bool yes, uint256 shares, uint256 minUsdcOut) external returns (uint256 usdcOut) {
        if (!isTrading()) revert NotTrading();
        if (shares == 0) revert NothingToDo();

        if (yes) {
            if (yesBalance[msg.sender] < shares) revert Insufficient();
            yesBalance[msg.sender] -= shares;
        } else {
            if (noBalance[msg.sender] < shares) revert Insufficient();
            noBalance[msg.sender] -= shares;
        }

        usdcOut = quoteSell(yes, shares);
        if (usdcOut == 0) revert NoLiquidity();
        if (usdcOut < minUsdcOut) revert Slippage();

        if (yes) {
            yesReserve += shares;
            yesReserve -= usdcOut;
            noReserve -= usdcOut;
        } else {
            noReserve += shares;
            noReserve -= usdcOut;
            yesReserve -= usdcOut;
        }
        totalYes -= usdcOut;
        totalNo -= usdcOut;

        usdcBalance[msg.sender] += usdcOut;
        credited += usdcOut;

        emit Sold(msg.sender, yes, shares, usdcOut);
    }

    // ── cash ────────────────────────────────────────────────────────────────

    function deposit(uint256 amount) external {
        if (amount == 0) revert NothingToDo();
        usdcBalance[msg.sender] += amount;
        credited += amount;
        if (!usdc.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        emit Deposited(msg.sender, amount);
    }

    /// @notice Never pausable, never restricted.
    function withdraw(uint256 amount) external {
        if (amount == 0) revert NothingToDo();
        if (usdcBalance[msg.sender] < amount) revert Insufficient();
        usdcBalance[msg.sender] -= amount;
        credited -= amount;
        if (!usdc.transfer(msg.sender, amount)) revert TransferFailed();
        emit Withdrawn(msg.sender, amount);
    }

    // ── resolution ──────────────────────────────────────────────────────────

    function proposeResolution(bool yesWon, bytes32 evidence) external {
        if (msg.sender != resolver) revert NotResolver();
        if (status != Status.Trading) revert BadState();
        resolvedYes = yesWon;
        evidenceHash = evidence;
        proposedAt = uint64(block.timestamp);
        status = Status.Closed;
        emit ResolutionProposed(yesWon, evidence, uint64(block.timestamp) + uint64(TIMELOCK));
    }

    function finalizeResolution() external {
        if (status != Status.Closed) revert BadState();
        if (block.timestamp < uint256(proposedAt) + TIMELOCK) revert TimelockActive();
        status = Status.Resolved;
        emit ResolutionFinalized(resolvedYes);
    }

    function voidMarket() external {
        if (status == Status.Resolved || status == Status.Voided) revert BadState();
        if (block.timestamp < voidAfter) revert TooEarly();
        status = Status.Voided;
        emit MarketVoided();
    }

    /**
     * @notice Winning shares pay 1 USDC each. The pool's own winning shares are
     *         paid to the seeder in the same call — that is how the liquidity
     *         provider settles up, for better or worse.
     */
    function redeem() external {
        if (status != Status.Resolved) revert BadState();

        uint256 userShares = resolvedYes ? yesBalance[msg.sender] : noBalance[msg.sender];
        uint256 poolShares = 0;

        if (msg.sender == seeder) {
            poolShares = resolvedYes ? yesReserve : noReserve;
            if (resolvedYes) yesReserve = 0;
            else noReserve = 0;
        }

        uint256 amount = userShares + poolShares;
        if (amount == 0) revert NothingToDo();

        if (resolvedYes) {
            yesBalance[msg.sender] = 0;
            totalYes -= amount;
        } else {
            noBalance[msg.sender] = 0;
            totalNo -= amount;
        }

        usdcBalance[msg.sender] += amount;
        credited += amount;

        emit Redeemed(msg.sender, amount, amount);
    }

    /// @notice Void: every share of either side is worth 0.5 USDC, so a YES + NO
    ///         pair returns exactly the 1 USDC it cost.
    function redeemVoided() external {
        if (status != Status.Voided) revert BadState();

        uint256 y = yesBalance[msg.sender];
        uint256 n = noBalance[msg.sender];
        uint256 out = y / 2 + n / 2;
        if (out == 0) revert NothingToDo();

        if (y > 0) {
            yesBalance[msg.sender] = 0;
            totalYes -= y;
        }
        if (n > 0) {
            noBalance[msg.sender] = 0;
            totalNo -= n;
        }

        usdcBalance[msg.sender] += out;
        credited += out;

        emit Redeemed(msg.sender, y + n, out);
    }

    // ── views ───────────────────────────────────────────────────────────────

    /// @notice Collateral minus obligations. Must never be negative.
    function solvencyGap() public view returns (int256) {
        int256 assets = int256(usdc.balanceOf(address(this)));
        int256 liabilities = int256(credited);

        if (status == Status.Voided) {
            liabilities += int256((totalYes + totalNo) / 2);
        } else if (status == Status.Resolved) {
            liabilities += int256(resolvedYes ? totalYes : totalNo);
        } else {
            liabilities += int256(totalYes > totalNo ? totalYes : totalNo);
        }
        return assets - liabilities;
    }
}
