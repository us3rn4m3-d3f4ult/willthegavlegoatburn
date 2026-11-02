import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AccountIdentity } from "@/components/AccountIdentity";
import { AccountView } from "@/components/AccountView";
import { Withdraw } from "@/components/Withdraw";
import { Portfolio } from "@/components/Portfolio";
import { OpenOrders } from "@/components/OpenOrders";
import { VerifyEmail } from "@/components/VerifyEmail";
import { sessionUserFromCookies } from "@/lib/session";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
  alternates: { canonical: "/account" },
};

export default async function AccountPage() {
  // Everything below reads balances, positions and orders from the connected
  // wallet. A wallet stays connected after signing out (and after deleting the
  // account), so without this gate a signed-out visitor keeps seeing "their"
  // money. No session, no account page.
  if (!(await sessionUserFromCookies())) redirect("/login");

  return (
    <div className="mx-auto max-w-[640px] py-10">
      <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-fg">Your account</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        Positions live on-chain and are read from your wallet, not from this account.
      </p>

      <div className="mt-6 space-y-4">
        <Suspense fallback={null}>
          <VerifyEmail />
        </Suspense>
        <AccountIdentity />
        <Portfolio />
        <OpenOrders />
        <Withdraw />
        <AccountView />
      </div>
    </div>
  );
}
