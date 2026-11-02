"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createWalletClient, custom, type Address, type WalletClient } from "viem";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useSession } from "@/components/useSession";
import { CHAIN_ID_PUBLIC, chain } from "@/lib/web3";

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: never[]) => void) => void;
  removeListener?: (event: string, handler: (...args: never[]) => void) => void;
};

/** An EIP-6963 wallet announcement: name, icon and its own provider. */
type Announced = { uuid: string; name: string; icon: string; provider: Eip1193 };

type WalletCtx = {
  account: Address | null;
  chainId: number | null;
  hasProvider: boolean;
  wrongChain: boolean;
  connecting: boolean;
  wallets: Announced[];
  connect: (target?: Announced) => Promise<void>;
  connectWalletConnect: () => Promise<void>;
  disconnect: () => void;
  ensureChain: () => Promise<boolean>;
  walletClient: () => WalletClient | null;
  connectError: string;
};

const Ctx = createContext<WalletCtx | null>(null);

let activeProvider: Eip1193 | null = null;

/** The wallet the user picked, or the legacy injected one. */
function provider(): Eip1193 | null {
  if (typeof window === "undefined") return null;
  return activeProvider ?? (window as unknown as { ethereum?: Eip1193 }).ethereum ?? null;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [hasProvider, setHasProvider] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [wallets, setWallets] = useState<Announced[]>([]);
  const [connectError, setConnectError] = useState("");
  const inFlight = useRef(false);

  // EIP-6963: every installed wallet announces itself with a name and icon, so we
  // can show a real picker instead of guessing what window.ethereum is.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent).detail as
        | { info?: { uuid: string; name: string; icon: string }; provider?: Eip1193 }
        | undefined;
      if (!detail?.info?.uuid || !detail.provider) return;
      setWallets((prev) =>
        prev.some((w) => w.uuid === detail.info!.uuid)
          ? prev
          : [
              ...prev,
              {
                uuid: detail.info!.uuid,
                name: detail.info!.name,
                icon: detail.info!.icon,
                provider: detail.provider as Eip1193,
              },
            ],
      );
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => window.removeEventListener("eip6963:announceProvider", onAnnounce);
  }, []);

  useEffect(() => {
    const eth = provider();
    if (!eth) return;
    setHasProvider(true);

    eth.request({ method: "eth_chainId" })
      .then((id) => setChainId(Number.parseInt(id as string, 16)))
      .catch(() => {});
    eth.request({ method: "eth_accounts" })
      .then((accs) => {
        const first = (accs as string[])[0];
        if (first) setAccount(first as Address);
      })
      .catch(() => {});

    const onAccounts = (accs: string[]) => setAccount((accs[0] as Address) ?? null);
    const onChain = (id: string) => setChainId(Number.parseInt(id, 16));
    eth.on?.("accountsChanged", onAccounts as never);
    eth.on?.("chainChanged", onChain as never);
    return () => {
      eth.removeListener?.("accountsChanged", onAccounts as never);
      eth.removeListener?.("chainChanged", onChain as never);
    };
  }, []);

  // Pull the WalletConnect bundle down in the background: it is large, and
  // downloading it on tap is what made mobile feel broken.
  useEffect(() => {
    const t = setTimeout(() => {
      void import("@walletconnect/ethereum-provider").catch(() => {});
    }, 4000);
    return () => clearTimeout(t);
  }, []);
  // Mobile: approving inside the wallet app never tells the browser tab. Re-read
  // the persisted WalletConnect session on load, and again every time the tab
  // comes back to the foreground after the hand-off.
  useEffect(() => {
    const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID;
    if (!projectId) return;
    let cancelled = false;

    const restore = async () => {
      try {
        const { EthereumProvider } = await import("@walletconnect/ethereum-provider");
        const wc = await EthereumProvider.init({
          projectId,
          chains: [CHAIN_ID_PUBLIC],
          showQrModal: false,
          metadata: {
            name: "willthegavlegoatburn",
            description: "Non-custodial prediction market on the Gavle goat",
            url: "https://willthegavlegoatburn.com",
            icons: ["https://willthegavlegoatburn.com/icon.svg"],
          },
        });
        if (!wc.session) return;
        const accs = (await wc.request({ method: "eth_accounts" })) as string[];
        if (cancelled || !accs || accs.length === 0 || !accs[0]) return;
        activeProvider = wc as unknown as Eip1193;
        setAccount(accs[0] as Address);
        const chainHex = (await wc.request({ method: "eth_chainId" })) as string;
        setChainId(Number.parseInt(chainHex, 16));
      } catch {
        // No stored session, or the relay is unreachable: leave the button alone.
      }
    };

    void restore();

    const onVisible = () => {
      if (document.visibilityState === "visible") void restore();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const connect = useCallback(async (target?: Announced) => {
    // MetaMask refuses a second wallet_requestPermissions while one is pending
    // (error -32002), which looks like "nothing happens". Never stack them.
    if (inFlight.current) return;
    inFlight.current = true;
    if (target) activeProvider = target.provider;
    // Some wallets only announce via EIP-6963 and never set window.ethereum, so
    // fall back to the announced provider before giving up.
    const eth = (target?.provider ?? provider() ?? wallets[0]?.provider) as Eip1193 | null;
    if (!eth) {
      inFlight.current = false;
      // No injected wallet: hand off to WalletConnect, which works in any browser.
      await connectWalletConnect();
      return;
    }
    setConnectError("");
    setConnecting(true);
    try {
      const accs = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      if (!accs || accs.length === 0) {
        setConnectError("The wallet returned no account. Unlock it and try again.");
        return;
      }
      setAccount((accs[0] as Address) ?? null);
      const id = (await eth.request({ method: "eth_chainId" })) as string;
      setChainId(Number.parseInt(id, 16));
    } catch (err) {
      const e = err as { code?: number; message?: string };
      if (e.code === -32002) {
        setConnectError(
          "Your wallet already has a request waiting for this site. Open MetaMask, approve or dismiss that popup, then click again.",
        );
      } else if (e.code === 4001) {
        setConnectError("You rejected the request in the wallet.");
      } else {
        setConnectError(e.message ? `Wallet error: ${e.message}` : "The wallet did not respond.");
      }
    } finally {
      inFlight.current = false;
      setConnecting(false);
    }
  }, [wallets]);

  /** WalletConnect: the only door in a mobile browser, via the wallet app. */
  const connectWalletConnect = useCallback(async () => {
    const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID;
    if (!projectId) {
      setConnectError("WalletConnect is not configured yet.");
      return;
    }
    setConnecting(true);
    setConnectError("");
    // The SDK is large and its modal can stall; never leave the button spinning
    // with nothing to explain why.
    const stall = setTimeout(() => {
      setConnecting(false);
      setConnectError(
        "WalletConnect is taking too long. On a phone, open this site inside MetaMask or Coinbase Wallet instead.",
      );
    }, 25_000);

    try {
      const { EthereumProvider } = await import("@walletconnect/ethereum-provider");
      const wc = await EthereumProvider.init({
        projectId,
        chains: [CHAIN_ID_PUBLIC],
        showQrModal: true,
        metadata: {
          name: "willthegavlegoatburn",
          description: "Non-custodial prediction market on the Gavle goat",
          url: "https://willthegavlegoatburn.com",
          icons: ["https://willthegavlegoatburn.com/icon.svg"],
        },
      });
      await wc.connect();
      const accs = (await wc.request({ method: "eth_accounts" })) as string[];
      const first = accs && accs[0];
      if (!first) {
        setConnectError("The wallet returned no account.");
        return;
      }
      activeProvider = wc as unknown as Eip1193;
      setAccount(first as Address);
      const chainHex = (await wc.request({ method: "eth_chainId" })) as string;
      setChainId(Number.parseInt(chainHex, 16));
      const eip = wc as unknown as Eip1193;
      eip.on?.("accountsChanged", ((a: string[]) => setAccount((a[0] as Address) ?? null)) as never);
      eip.on?.("chainChanged", ((id: string) => setChainId(Number.parseInt(id, 16))) as never);
    } catch {
      setConnectError("WalletConnect did not complete. Try again.");
    } finally {
      clearTimeout(stall);

      setConnecting(false);
    }
  }, []);
  const disconnect = useCallback(() => {
    setAccount(null);
  }, []);

  /** Switch the wallet to the configured chain, adding it if unknown. */
  const ensureChain = useCallback(async (): Promise<boolean> => {
    const eth = provider();
    if (!eth) return false;
    if (chainId === CHAIN_ID_PUBLIC) return true;

    const hexId = `0x${CHAIN_ID_PUBLIC.toString(16)}`;
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexId }],
      });
      setChainId(CHAIN_ID_PUBLIC);
      return true;
    } catch (err) {
      const code = (err as { code?: number }).code;
      if (code !== 4902) return false;
      try {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: hexId,
              chainName: chain.name,
              nativeCurrency: chain.nativeCurrency,
              rpcUrls: chain.rpcUrls.default.http,
            },
          ],
        });
        setChainId(CHAIN_ID_PUBLIC);
        return true;
      } catch {
        return false;
      }
    }
  }, [chainId]);

  const walletClient = useCallback((): WalletClient | null => {
    const eth = provider();
    if (!eth || !account) return null;
    return createWalletClient({ account, chain, transport: custom(eth as never) });
  }, [account]);

  const value = useMemo(
    () => ({
      account,
      chainId,
      hasProvider,
      wrongChain: account !== null && chainId !== null && chainId !== CHAIN_ID_PUBLIC,
      connecting,
      wallets,
      connect,
      connectWalletConnect,
      disconnect,
      ensureChain,
      walletClient,
      connectError,
    }),
    [account, chainId, hasProvider, connecting, wallets, connect, connectWalletConnect, disconnect, ensureChain, walletClient, connectError],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet(): WalletCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}

export function ConnectWallet() {
  const { account, connect, connectWalletConnect, disconnect, connecting, hasProvider, wrongChain, ensureChain, wallets, connectError } =
    useWallet();
  const signedIn = useSession();
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  // The header has backdrop-blur, which makes position:fixed children position
  // against the header instead of the viewport. Portal the dialog to <body> so it
  // truly centres and the dimmer covers the whole screen.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Close the dialog once a wallet actually answers — not on click, which would
  // hide the pending request and make failures invisible.
  useEffect(() => {
    if (account) setOpen(false);
  }, [account]);
  const anyProvider = hasProvider || wallets.length > 0;

  // Account comes first: a wallet is useless here until there is a user behind it.
  if (signedIn === null) {
    return (
      <span
        className="hidden h-8 w-[92px] animate-pulse rounded-btn bg-surface2 lg:block"
        aria-hidden
      />
    );
  }

  if (signedIn === false) {
    return (
      <Link
        href="/register"
        className="hidden h-8 items-center rounded-btn bg-fg px-3 text-[12px] font-semibold text-black transition-opacity hover:opacity-90 lg:flex"
      >
        Register
      </Link>
    );
  }

  if (!anyProvider) {
    // No injected wallet: WalletConnect is the only way in from a mobile browser.
    return (
      <button
        onClick={connectWalletConnect}
        disabled={connecting}
        className="h-8 rounded-btn bg-fg px-3 text-[12px] font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {connecting ? "Opening…" : "Connect wallet"}
      </button>
    );
  }

  if (!account) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          disabled={connecting}
          className="h-8 rounded-btn bg-fg px-3 text-[12px] font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {connecting ? "Connecting…" : "Connect wallet"}
        </button>

        {open && mounted
          ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Choose a wallet"
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <div
              className="w-full max-w-[360px] panel p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-fg">Connect a wallet</h2>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="text-[16px] leading-none text-dim hover:text-fg"
                >
                  ×
                </button>
              </div>

              <ul className="mt-3 space-y-1.5">
                {wallets.length === 0 ? (
                  <li className="text-[12px] text-muted">
                    No wallet extension detected. Install MetaMask, Rabby or Coinbase Wallet.
                  </li>
                ) : (
                  wallets.map((w) => (
                    <li key={w.uuid}>
                      <button
                        disabled={connecting}
                        onClick={() => connect(w)}
                        className="flex w-full items-center gap-3 rounded-btn border border-line bg-black px-3 py-2.5 text-left transition-colors hover:border-line2 disabled:opacity-60"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={w.icon} alt="" width={22} height={22} className="rounded-[2px]" />
                        <span className="text-[12.5px] font-medium text-fg">{w.name}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>

              <p className="mt-3 text-[11px] leading-relaxed text-dim">
                Only wallets installed in this browser appear here. Mobile wallets need
                WalletConnect, which is not configured yet.
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-dim">
                To trade you need <span className="text-muted">USDC on Base</span>. USDC on
                any other network will not show up.
              </p>

              {connecting ? (
                <p className="mt-2 text-[11px] leading-relaxed text-muted">
                  Waiting for your wallet. If nothing opened, click the wallet icon in your
                  browser toolbar.
                </p>
              ) : null}

              {connectError ? (
                <p className="mt-2 border border-ember/40 bg-ember/10 px-2.5 py-2 text-[11px] leading-relaxed text-ember">
                  {connectError}
                </p>
              ) : null}
            </div>
          </div>,
            document.body,
          )
          : null}
      </>
    );
  }

  if (wrongChain) {
    return (
      <button
        onClick={ensureChain}
        className="h-8 rounded-btn border border-yes/40 px-3 text-[12px] font-medium text-yes hover:bg-yes/10"
      >
        Switch network
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <span className="num rounded-btn border border-line px-2.5 py-1.5 font-mono text-[11.5px] text-fg">
        {account.slice(0, 6)}…{account.slice(-4)}
      </span>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(account);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            setCopied(false);
          }
        }}
        title="Copy wallet address"
        aria-label="Copy wallet address"
        className="flex h-8 w-8 items-center justify-center rounded-btn border border-line text-muted transition-colors hover:border-line2 hover:text-fg"
      >
        {copied ? (
          <span className="text-[12px] text-yes">✓</span>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M15 5H6a1 1 0 0 0-1 1v9"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
