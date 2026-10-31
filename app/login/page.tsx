import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
  alternates: { canonical: "/login" },
};

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-[420px] py-16">
      <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-fg">Sign in</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        Accounts are optional. They hold a profile only — never funds.
      </p>

      <div className="mt-6 rounded-card border border-line bg-surface p-5">
        <AuthForm mode="login" />
      </div>

      <p className="mt-4 text-center text-[11.5px] leading-relaxed text-dim">
        Forgot your password? Reset by email is not configured yet — it needs a
        transactional mail provider. Until then, use “Delete account” and register
        again.
      </p>
    </div>
  );
}
