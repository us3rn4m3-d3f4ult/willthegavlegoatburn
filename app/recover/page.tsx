import type { Metadata } from "next";
import { RecoverForm } from "@/components/RecoverForm";

export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false, follow: false },
  alternates: { canonical: "/recover" },
};

export default function RecoverPage() {
  return (
    <div className="mx-auto max-w-[420px] py-16">
      <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-fg">Reset password</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        Use one of the recovery codes you saved when you created the account. Each
        code works once.
      </p>

      <div className="mt-6 rounded-card border border-line bg-surface p-5">
        <RecoverForm />
      </div>

      <p className="mt-4 text-center text-[11.5px] leading-relaxed text-dim">
        Lost your codes too? There is no other way back — there is no password-reset
        email. You can register again with a different address.
      </p>
    </div>
  );
}
