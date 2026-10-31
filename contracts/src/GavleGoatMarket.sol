// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address who) external view returns (uint256);
}

/**
 * @title GavleGoatMarket
 * @notice Binary prediction market with an on-chain order book. One question,
 *         two outcomes, USDC settlement, zero fees.
 *
 * Money model
 * -----------
 * Users hold an internal USDC balance inside this contract. `withdraw` is never
 * pausable, there is no owner, no fee switch and no treasury. No function can
 * move one user's balance to another user's balance except a fill at a price
 * that user themselves signed.
 *
 * Shares
 * ------
 * 1 USDC splits into 1 YES + 1 NO and merges back. Every split is fully backed,
 * so `totalYes == totalNo` at all times and the contract always holds at least
 * one USDC of collateral per outstanding share pair.
 *
 * Safety invariants (enforced by test/invariant tests)
 * ---------------------------------------------------
 *  I1  usdc.balanceOf(this) == totalUsdcCredited + escrowedUsdc + totalYes
 *  I2  totalYes == totalNo
 *  I3  no path moves USDC out except withdraw / refund of the caller's own funds
 *  I4  once status != Trading nothing can be filled, and every open order can be
 *      cancelled by anyone
 */
contract GavleGoatMarket {
    // ── constants ───────────────────────────────────────────────────────────
    uint256 public constant PRICE_SCALE = 1e18; // 1e18 = 1.00 USDC per share
    uint256 public constant MIN_ORDER_SHARES = 1e6; // 1 share (6 decimals)
    uint256 public constant TIMELOCK = 72 hours;
    uint256 public constant VOID_GRACE = 30 days;
    uint256 public constant MAX_ORDERS_PER_USER = 32;

    // ── types ───────────────────────────────────────────────────────────────
    enum Status {
        Trading,
        Closed,
        Resolved,
        Voided
    }

    struct Order {
        address maker;
        bool isYes;
        bool isAsk;
        bool active;
        uint64 expiresAt;
        uint256 shares; // remaining shares
        uint256 price; // USDC per share, 1e18 scale
        uint256 escrow; // remaining USDC escrowed (bids only)
    }

    // ── immutables ──────────────────────────────────────────────────────────
    IERC20 public immutable usdc;
    address public immutable resolver;
    uint64 public immutable bettingClosesAt;
    uint64 public immutable resolutionDeadline;
    uint64 public immutable voidAfter;

    // ── state ───────────────────────────────────────────────────────────────
    Status public status;

    uint64 public proposedAt;
    bool public proposedYesWon;
    bytes32 public evidenceHash;
    uint256 public nextOrderId = 1;

    mapping(address => uint256) public usdcBalance;
    mapping(address => uint256) public yesBalance;
    mapping(address => uint256) public noBalance;

    mapping(address => uint256) public lockedYes;
    mapping(address => uint256) public lockedNo;
    mapping(address => uint256) public openOrders;

    mapping(uint256 => Order) public orders;

    uint256 public totalYes;
    uint256 public totalNo;
    uint256 public escrowedUsdc;
    uint256 public totalUsdcCredited;

    // ── events ──────────────────────────────────────────────────────────────
    event Deposited(address indexed account, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);
    event Split(address indexed account, uint256 amount);
    event Merged(address indexed account, uint256 amount);
    event OrderPlaced(
        uint256 indexed id,
        address indexed maker,
        bool isYes,
        bool isAsk,
        uint256 shares,
        uint256 price,
        uint64 expiresAt
    );
    event OrderFilled(
        uint256 indexed id,
        address indexed taker,
        uint256 shares,
        uint256 usdcAmount
    );
    event OrderCancelled(uint256 indexed id, address indexed by);
    event ResolutionProposed(bool yesWon, bytes32 evidenceHash, uint64 finalizesAt);
    event ResolutionFinalized(bool yesWon);
    event MarketVoided();
    event Redeemed(address indexed account, uint256 shares, uint256 usdcOut);

    // ── errors ──────────────────────────────────────────────────────────────
    error NotTrading();
    error NotResolver();
    error BadState();
    error BadOrder();
    error TooManyOrders();
    error InsufficientShares();
    error InsufficientUsdc();
    error SelfTrade();
    error TimelockActive();
    error TooEarly();
    error NothingToDo();
    error TransferFailed();

    modifier onlyResolver() {
        if (msg.sender != resolver) revert NotResolver();
        _;
    }

    constructor(
        IERC20 usdc_,
        address resolver_,
        uint64 bettingClosesAt_,
        uint64 resolutionDeadline_
    ) {
        require(address(usdc_) != address(0), "usdc");
        require(resolver_ != address(0), "resolver");
        require(bettingClosesAt_ > block.timestamp, "closes in past");
        require(resolutionDeadline_ > bettingClosesAt_, "deadline");

        usdc = usdc_;
        resolver = resolver_;
        bettingClosesAt = bettingClosesAt_;
        resolutionDeadline = resolutionDeadline_;
        voidAfter = resolutionDeadline_ + uint64(VOID_GRACE);
    }

    // ── collateral ──────────────────────────────────────────────────────────

    function deposit(uint256 amount) external {
        if (amount == 0) revert NothingToDo();
        usdcBalance[msg.sender] += amount;
        totalUsdcCredited += amount;
        if (!usdc.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        emit Deposited(msg.sender, amount);
    }

    /// @notice Always available. There is no pause, no cooldown, no whitelist.
    function withdraw(uint256 amount) external {
        if (amount == 0) revert NothingToDo();
        if (usdcBalance[msg.sender] < amount) revert InsufficientUsdc();
        usdcBalance[msg.sender] -= amount;
        totalUsdcCredited -= amount;
        if (!usdc.transfer(msg.sender, amount)) revert TransferFailed();
        emit Withdrawn(msg.sender, amount);
    }

    function split(uint256 amount) external {
        if (amount == 0) revert NothingToDo();
        if (usdcBalance[msg.sender] < amount) revert InsufficientUsdc();
        usdcBalance[msg.sender] -= amount;
        totalUsdcCredited -= amount;
        yesBalance[msg.sender] += amount;
        noBalance[msg.sender] += amount;
        totalYes += amount;
        totalNo += amount;
        emit Split(msg.sender, amount);
    }

    function merge(uint256 amount) external {
        if (amount == 0) revert NothingToDo();
        if (freeShares(msg.sender, true) < amount || freeShares(msg.sender, false) < amount) {
            revert InsufficientShares();
        }
        yesBalance[msg.sender] -= amount;
        noBalance[msg.sender] -= amount;
        totalYes -= amount;
        totalNo -= amount;
        usdcBalance[msg.sender] += amount;
        totalUsdcCredited += amount;
        emit Merged(msg.sender, amount);
    }

    // ── orders ──────────────────────────────────────────────────────────────

    function placeAsk(bool isYes, uint256 shares, uint256 price, uint64 expiresAt)
        external
        returns (uint256 id)
    {
        _requireOpen();
        _validate(shares, price, expiresAt);
        if (freeShares(msg.sender, isYes) < shares) revert InsufficientShares();
        _lock(msg.sender, isYes, shares);
        id = _newOrder(msg.sender, isYes, true, shares, price, expiresAt, 0);
    }

    function placeBid(bool isYes, uint256 shares, uint256 price, uint64 expiresAt)
        external
        returns (uint256 id)
    {
        _requireOpen();
        _validate(shares, price, expiresAt);
        uint256 cost = _cost(shares, price);
        if (cost == 0) revert BadOrder();
        if (usdcBalance[msg.sender] < cost) revert InsufficientUsdc();
        usdcBalance[msg.sender] -= cost;
        totalUsdcCredited -= cost;
        escrowedUsdc += cost;
        id = _newOrder(msg.sender, isYes, false, shares, price, expiresAt, cost);
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    function _requireOpen() private view {
        if (status != Status.Trading || block.timestamp >= bettingClosesAt) revert NotTrading();
    }

    function _validate(uint256 shares, uint256 price, uint64 expiresAt) private view {
        if (shares < MIN_ORDER_SHARES) revert BadOrder();
        if (price == 0 || price > PRICE_SCALE) revert BadOrder();
        if (expiresAt <= block.timestamp || expiresAt > bettingClosesAt) revert BadOrder();
        if (openOrders[msg.sender] >= MAX_ORDERS_PER_USER) revert TooManyOrders();
    }

    function _cost(uint256 shares, uint256 price) private pure returns (uint256) {
        return shares * price / PRICE_SCALE;
    }

    function _newOrder(
        address maker,
        bool isYes,
        bool isAsk,
        uint256 shares,
        uint256 price,
        uint64 expiresAt,
        uint256 escrow
    ) private returns (uint256 id) {
        id = nextOrderId++;
        orders[id] = Order({
            maker: maker,
            isYes: isYes,
            isAsk: isAsk,
            active: true,
            expiresAt: expiresAt,
            shares: shares,
            price: price,
            escrow: escrow
        });
        openOrders[maker] += 1;
        emit OrderPlaced(id, maker, isYes, isAsk, shares, price, expiresAt);
    }

    function _lock(address account, bool isYes, uint256 amount) private {
        if (isYes) lockedYes[account] += amount;
        else lockedNo[account] += amount;
    }

    function _unlock(address account, bool isYes, uint256 amount) private {
        if (isYes) {
            uint256 l = lockedYes[account];
            lockedYes[account] = l > amount ? l - amount : 0;
        } else {
            uint256 l = lockedNo[account];
            lockedNo[account] = l > amount ? l - amount : 0;
        }
    }

    function _takeFreeShares(address account, bool isYes, uint256 amount) private {
        if (freeShares(account, isYes) < amount) revert InsufficientShares();
        if (isYes) yesBalance[account] -= amount;
        else noBalance[account] -= amount;
    }

    function _giveShares(address account, bool isYes, uint256 amount) private {
        if (isYes) yesBalance[account] += amount;
        else noBalance[account] += amount;
    }

    /// @notice Shares a user can commit to a new order.
    function freeShares(address account, bool isYes) public view returns (uint256) {
        if (isYes) {
            uint256 b = yesBalance[account];
            uint256 l = lockedYes[account];
            return b > l ? b - l : 0;
        }
        uint256 bn = noBalance[account];
        uint256 ln = lockedNo[account];
        return bn > ln ? bn - ln : 0;
    }

    // ── fills ───────────────────────────────────────────────────────────────

    /// @notice Buy YES/NO shares from a resting ask. Pay USDC from your balance.
    function fillAsk(uint256 id, uint256 shares) external {
        _requireOpen();
        Order storage o = orders[id];
        if (!o.active || !o.isAsk) revert BadOrder();
        if (msg.sender == o.maker) revert SelfTrade();

        uint256 s = shares > o.shares ? o.shares : shares;
        if (s == 0) revert NothingToDo();
        uint256 cost = _cost(s, o.price);
        if (cost == 0) revert BadOrder();
        if (usdcBalance[msg.sender] < cost) revert InsufficientUsdc();

        // USDC moves taker -> maker. totalUsdcCredited is unchanged.
        usdcBalance[msg.sender] -= cost;
        usdcBalance[o.maker] += cost;

        _unlock(o.maker, o.isYes, s);
        _takeFreeShares(o.maker, o.isYes, s);
        _giveShares(msg.sender, o.isYes, s);

        o.shares -= s;
        if (o.shares == 0) _close(o);

        emit OrderFilled(id, msg.sender, s, cost);
    }

    /// @notice Sell YES/NO shares into a resting bid. Receive the bidder's escrow.
    function fillBid(uint256 id, uint256 shares) external {
        _requireOpen();
        Order storage o = orders[id];
        if (!o.active || o.isAsk) revert BadOrder();
        if (msg.sender == o.maker) revert SelfTrade();

        uint256 s = shares > o.shares ? o.shares : shares;
        if (s == 0) revert NothingToDo();
        uint256 cost = _cost(s, o.price);
        if (cost == 0 || cost > o.escrow) revert BadOrder();

        _takeFreeShares(msg.sender, o.isYes, s);
        _giveShares(o.maker, o.isYes, s);

        o.escrow -= cost;
        o.shares -= s;
        escrowedUsdc -= cost;
        usdcBalance[msg.sender] += cost;
        totalUsdcCredited += cost;
        if (o.shares == 0) _close(o);

        emit OrderFilled(id, msg.sender, s, cost);
    }

    /// @notice Maker can always cancel. Anyone can cancel once the order expired
    ///         or the market stopped trading, so no funds can ever be stranded.
    function cancelOrder(uint256 id) external {
        Order storage o = orders[id];
        if (!o.active) revert BadOrder();

        bool expired = block.timestamp > o.expiresAt;
        bool frozen = status != Status.Trading || block.timestamp >= bettingClosesAt;
        if (msg.sender != o.maker && !expired && !frozen) revert BadOrder();

        if (o.isAsk) {
            _unlock(o.maker, o.isYes, o.shares);
        } else {
            uint256 refund = o.escrow;
            if (refund > 0) {
                o.escrow = 0;
                escrowedUsdc -= refund;
                usdcBalance[o.maker] += refund;
                totalUsdcCredited += refund;
            }
        }

        _close(o);
        emit OrderCancelled(id, msg.sender);
    }

    function _close(Order storage o) private {
        o.active = false;
        uint256 n = openOrders[o.maker];
        if (n > 0) openOrders[o.maker] = n - 1;
    }

    // ── resolution ──────────────────────────────────────────────────────────

    /// @notice Freezes the market immediately and starts the timelock. During the
    ///         timelock the proposal is public and can be objected to off-chain.
    function proposeResolution(bool yesWon, bytes32 evidence) external onlyResolver {
        if (status != Status.Trading) revert BadState();
        proposedYesWon = yesWon;
        evidenceHash = evidence;
        proposedAt = uint64(block.timestamp);
        status = Status.Closed;
        emit ResolutionProposed(yesWon, evidence, uint64(block.timestamp) + uint64(TIMELOCK));
    }

    function finalizeResolution() external {
        if (status != Status.Closed) revert BadState();
        if (block.timestamp < uint256(proposedAt) + TIMELOCK) revert TimelockActive();
        status = Status.Resolved;
        emit ResolutionFinalized(proposedYesWon);
    }

    /// @notice Permissionless escape hatch. If nobody resolves, everyone recovers
    ///         half of every share — nobody can be trapped by an absent resolver.
    function voidMarket() external {
        if (status == Status.Resolved || status == Status.Voided) revert BadState();
        if (block.timestamp < voidAfter) revert TooEarly();
        status = Status.Voided;
        emit MarketVoided();
    }

    // ── payouts ─────────────────────────────────────────────────────────────

    function redeem() external {
        if (status != Status.Resolved) revert BadState();
        bool win = proposedYesWon;

        uint256 amount = win ? yesBalance[msg.sender] : noBalance[msg.sender];
        if (amount == 0) revert NothingToDo();

        if (win) {
            yesBalance[msg.sender] = 0;
            lockedYes[msg.sender] = 0;
            totalYes -= amount;
        } else {
            noBalance[msg.sender] = 0;
            lockedNo[msg.sender] = 0;
            totalNo -= amount;
        }

        usdcBalance[msg.sender] += amount;
        totalUsdcCredited += amount;
        emit Redeemed(msg.sender, amount, amount);
    }

    /// @notice Void payout: every share of either side is worth 0.5 USDC, so each
    ///         split pair returns exactly its 1 USDC. Dust from rounding stays.
    function redeemVoided() external {
        if (status != Status.Voided) revert BadState();

        uint256 y = yesBalance[msg.sender];
        uint256 n = noBalance[msg.sender];
        uint256 out = y / 2 + n / 2;
        if (out == 0) revert NothingToDo();

        if (y > 0) {
            yesBalance[msg.sender] = 0;
            lockedYes[msg.sender] = 0;
            totalYes -= y;
        }
        if (n > 0) {
            noBalance[msg.sender] = 0;
            lockedNo[msg.sender] = 0;
            totalNo -= n;
        }

        usdcBalance[msg.sender] += out;
        totalUsdcCredited += out;
        emit Redeemed(msg.sender, y + n, out);
    }

    // ── views ───────────────────────────────────────────────────────────────

    /// @notice True while new orders and fills are allowed.
    function isTrading() public view returns (bool) {
        return status == Status.Trading && block.timestamp < bettingClosesAt;
    }

    /// @notice USDC required to take `shares` from ask `id` right now.
    function previewFill(uint256 id, uint256 shares) external view returns (uint256 cost) {
        Order storage o = orders[id];
        uint256 s = shares > o.shares ? o.shares : shares;
        return _cost(s, o.price);
    }

    /// @notice Collateral minus obligations. Must never be negative.
    function solvencyGap() public view returns (int256) {
        int256 assets = int256(usdc.balanceOf(address(this)));
        int256 liabilities = int256(totalUsdcCredited) + int256(escrowedUsdc);

        if (status == Status.Resolved) {
            // Only the winning side is redeemable; the losing side is worth zero.
            liabilities += int256(proposedYesWon ? totalYes : totalNo);
        } else if (status == Status.Voided) {
            // Both sides pay 0.5 each, so a full pair returns exactly 1 USDC.
            liabilities += int256((totalYes + totalNo) / 2);
        } else {
            // Before resolution the maximum payout is one side at 1 USDC per share.
            // totalYes == totalNo while trading, so either works.
            liabilities += int256(totalYes > totalNo ? totalYes : totalNo);
        }
        return assets - liabilities;
    }

    function finalizesAt() external view returns (uint64) {
        if (proposedAt == 0) return 0;
        return proposedAt + uint64(TIMELOCK);
    }
}
