import { createPublicClient, defineChain, http, type Address } from "viem";

/**
 * Minimal on-chain plumbing. No wagmi, no WalletConnect project id, no extra
 * dependencies — the injected provider (MetaMask, Coinbase Wallet extension) plus
 * viem's public client is enough for reads and writes.
 *
 * Everything is driven by NEXT_PUBLIC_* env vars so the same build works against
 * the devnet or a real network.
 */

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 84532);
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://sepolia.base.org";

export const chain = defineChain({
  id: CHAIN_ID,
  name: CHAIN_ID === 8453 ? "Base" : CHAIN_ID === 84532 ? "Base Sepolia" : `Chain ${CHAIN_ID}`,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers:
    CHAIN_ID === 8453
      ? { default: { name: "Basescan", url: "https://basescan.org" } }
      : CHAIN_ID === 84532
        ? { default: { name: "Basescan", url: "https://sepolia.basescan.org" } }
        : undefined,
});

// The Alchemy app is restricted to this site's domain, and only the browser sends
// an Origin header automatically — server-side reads must send it too or they 403.
const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://willthegavlegoatburn.com";

export const publicClient = createPublicClient({
  chain,
  transport: http(
    RPC_URL,
    typeof window === "undefined" ? { fetchOptions: { headers: { origin: SITE_ORIGIN } } } : {},
  ),
});


const market = process.env.NEXT_PUBLIC_MARKET_ADDRESS ?? "";
const usdc = process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "";

/** True when a market has been deployed and pointed at. */
export const CONFIGURED = /^0x[0-9a-fA-F]{40}$/.test(market) && /^0x[0-9a-fA-F]{40}$/.test(usdc);

export const MARKET_ADDRESS = market as Address;
export const USDC_ADDRESS = usdc as Address;
export const CHAIN_ID_PUBLIC = CHAIN_ID;

const book = process.env.NEXT_PUBLIC_BOOK_ADDRESS ?? "";

/** True when an order-book market has been deployed and pointed at. */
export const BOOK_CONFIGURED = /^0x[0-9a-fA-F]{40}$/.test(book);
export const BOOK_ADDRESS = book as Address;

export const BOOK_ABI = [
  { type: "function", name: "nextOrderId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "isTrading", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  {
    type: "function",
    name: "orders",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "maker", type: "address" },
      { name: "isYes", type: "bool" },
      { name: "isAsk", type: "bool" },
      { name: "active", type: "bool" },
      { name: "expiresAt", type: "uint64" },
      { name: "shares", type: "uint256" },
      { name: "price", type: "uint256" },
      { name: "escrow", type: "uint256" },
    ],
  },
] as const;

export const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const AMM_ABI = [
  { type: "function", name: "yesPrice", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "yesReserve",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "noReserve",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "event",
    name: "Bought",
    inputs: [
      { name: "by", type: "address", indexed: true },
      { name: "yes", type: "bool", indexed: false },
      { name: "usdcIn", type: "uint256", indexed: false },
      { name: "sharesOut", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Sold",
    inputs: [
      { name: "by", type: "address", indexed: true },
      { name: "yes", type: "bool", indexed: false },
      { name: "sharesIn", type: "uint256", indexed: false },
      { name: "usdcOut", type: "uint256", indexed: false },
    ],
  },
  {
    type: "function",
    name: "yesBalance",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "noBalance",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "usdcBalance",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "quoteBuy",
    stateMutability: "view",
    inputs: [{ name: "yes", type: "bool" }, { name: "amount", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "quoteSell",
    stateMutability: "view",
    inputs: [{ name: "yes", type: "bool" }, { name: "shares", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "buy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "yes", type: "bool" },
      { name: "amount", type: "uint256" },
      { name: "minSharesOut", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "sell",
    stateMutability: "nonpayable",
    inputs: [
      { name: "yes", type: "bool" },
      { name: "shares", type: "uint256" },
      { name: "minUsdcOut", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;
