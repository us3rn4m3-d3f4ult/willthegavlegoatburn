import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = {
  title: "Create account",
  robots: { index: false, follow: false },
  alternates: { canonical: "/register" },
};

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-[420px] py-16">
      <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-fg">Create account</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        Email and a password. You can delete it again in one click, permanently.
      </p>

      <div className="mt-6 rounded-card border border-line bg-surface p-5">
        <AuthForm mode="register" />
      </div>

      <p className="mt-4 text-center text-[11.5px] leading-relaxed text-dim">
        By creating an account you accept the{" "}
        <a href="/terms" className="text-muted underline decoration-line2 underline-offset-2">
          terms
        </a>{" "}
        and the{" "}
        <a href="/privacy" className="text-muted underline decoration-line2 underline-offset-2">
          privacy statement
        </a>
        .
      </p>
    </div>
  );
}
