import type { Metadata } from "next";
import { AccountIdentity } from "@/components/AccountIdentity";
import { AccountView } from "@/components/AccountView";
import { Withdraw } from "@/components/Withdraw";
import { Portfolio } from "@/components/Portfolio";
import { OpenOrders } from "@/components/OpenOrders";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
  alternates: { canonical: "/account" },
};

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-[640px] py-10">
      <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-fg">Your account</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        Positions live on-chain and are read from your wallet, not from this account.
      </p>

      <div className="mt-6 space-y-4">
        <AccountIdentity />
        <Portfolio />
        <OpenOrders />
        <Withdraw />
        <AccountView />
      </div>
    </div>
  );
}
