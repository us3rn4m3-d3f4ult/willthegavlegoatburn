"use client";

import { useEffect, useState } from "react";
import { AbstractAvatar } from "@/components/AbstractAvatar";

type Me = {
  user: { id: string; email: string; createdAt: string } | null;
  sessions: number;
};

/** The account card at the top of settings: who you are, and on how many devices. */
export function AccountIdentity() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json() as Promise<Me>)
      .then(setMe)
      .catch(() => {});
  }, []);

  if (!me?.user) return null;

  return (
    <div className="panel flex items-center gap-4 p-5">
      <AbstractAvatar seed={me.user.email} size={48} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-fg">{me.user.email}</p>
        <p className="mt-0.5 text-[11.5px] text-dim">
          Joined{" "}
          {new Date(me.user.createdAt).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
          {" · "}
          {me.sessions} active session{me.sessions === 1 ? "" : "s"}
        </p>
      </div>
    </div>
  );
}
