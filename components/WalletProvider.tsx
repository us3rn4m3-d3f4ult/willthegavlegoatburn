"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createWalletClient, custom, type Address, type WalletClient } from "viem";
import { CHAIN_ID_PUBLIC, chain } from "@/lib/web3";

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: never[]) => void) => void;
  removeListener?: (event: string, handler: (...args: never[]) => void) => void;
};

type WalletCtx = {
  account: Address | null;
  chainId: number | null;
  hasProvider: boolean;
  wrongChain: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  ensureChain: () => Promise<boolean>;
  walletClient: () => WalletClient | null;
};

const Ctx = createContext<WalletCtx | null>(null);

function provider(): Eip1193 | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { ethereum?: Eip1193 }).ethereum ?? null;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [hasProvider, setHasProvider] = useState(false);
  const [connecting, setConnecting] = useState(false);

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

  const connect = useCallback(async () => {
    const eth = provider();
    if (!eth) return;
    setConnecting(true);
    try {
      const accs = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      setAccount((accs[0] as Address) ?? null);
      const id = (await eth.request({ method: "eth_chainId" })) as string;
      setChainId(Number.parseInt(id, 16));
    } catch {
      // user rejected - nothing to do
    } finally {
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
      connect,
      disconnect,
      ensureChain,
      walletClient,
    }),
    [account, chainId, hasProvider, connecting, connect, disconnect, ensureChain, walletClient],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet(): WalletCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}

export function ConnectWallet() {
  const { account, connect, disconnect, connecting, hasProvider, wrongChain, ensureChain } =
    useWallet();

  if (!hasProvider) {
    return (
      <span className="hidden text-[11.5px] text-dim sm:inline">No wallet detected</span>
    );
  }

  if (!account) {
    return (
      <button
        onClick={connect}
        disabled={connecting}
        className="h-8 rounded-btn bg-fg px-3 text-[12px] font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {connecting ? "Connecting…" : "Connect wallet"}
      </button>
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
    <button
      onClick={disconnect}
      title="Click to disconnect"
      className="num h-8 rounded-btn border border-line px-3 font-mono text-[11.5px] text-muted transition-colors hover:border-line2 hover:text-fg"
    >
      {account.slice(0, 6)}…{account.slice(-4)}
    </button>
  );
}
