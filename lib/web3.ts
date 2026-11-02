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
  // `publicClient.multicall` looks the address up on the chain object and throws
  // "chain does not support contract multicall3" without this. Same address on
  // every chain we use; it is the canonical deployment.
  contracts: {
    multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" },
  },
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
  transport: http(RPC_URL, {
    ...(typeof window === "undefined" ? { fetchOptions: { headers: { origin: SITE_ORIGIN } } } : {}),
  }),
});


const usdc = process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "";

export const USDC_ADDRESS = usdc as Address;
export const CHAIN_ID_PUBLIC = CHAIN_ID;

const book = process.env.NEXT_PUBLIC_BOOK_ADDRESS ?? "";

/** True when an order-book market has been deployed and pointed at. */
export const BOOK_CONFIGURED = /^0x[0-9a-fA-F]{40}$/.test(book);
export const BOOK_ADDRESS = book as Address;

export const BOOK_ABI = [
  { type: "function", name: "nextOrderId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "isTrading", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "PRICE_SCALE", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "MIN_ORDER_SHARES", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "bettingClosesAt", stateMutability: "view", inputs: [], outputs: [{ type: "uint64" }] },
  {
    type: "function",
    name: "placeAsk",
    stateMutability: "nonpayable",
    inputs: [
      { name: "isYes", type: "bool" },
      { name: "shares", type: "uint256" },
      { name: "price", type: "uint256" },
      { name: "expiresAt", type: "uint64" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "placeBid",
    stateMutability: "nonpayable",
    inputs: [
      { name: "isYes", type: "bool" },
      { name: "shares", type: "uint256" },
      { name: "price", type: "uint256" },
      { name: "expiresAt", type: "uint64" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "fillAsk",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }, { name: "shares", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "fillBid",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }, { name: "shares", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "cancelOrder",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "split",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "merge",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "previewFill",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }, { name: "shares", type: "uint256" }],
    outputs: [{ name: "cost", type: "uint256" }],
  },
  {
    type: "function",
    name: "freeShares",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }, { name: "isYes", type: "bool" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "openOrders",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "lockedYes",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "lockedNo",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "usdc",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
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
