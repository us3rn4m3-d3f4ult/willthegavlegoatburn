"use client";

import { useEffect, useState } from "react";

function diff(target: number) {
  const ms = Math.max(0, target - Date.now());
  return {
    d: Math.floor(ms / 86_400_000),
    h: Math.floor((ms % 86_400_000) / 3_600_000),
    m: Math.floor((ms % 3_600_000) / 60_000),
    done: ms === 0,
  };
}

export function Countdown({ to }: { to: string }) {
  const target = new Date(to).getTime();
  const [t, setT] = useState<ReturnType<typeof diff> | null>(null);

  useEffect(() => {
    setT(diff(target));
    const id = setInterval(() => setT(diff(target)), 60_000);
    return () => clearInterval(id);
  }, [target]);

  if (!t) {
    return <span className="num text-[13px] text-muted">—</span>;
  }

  return (
    <span className="num text-[13px] font-medium text-fg">
      {t.d}d {String(t.h).padStart(2, "0")}h {String(t.m).padStart(2, "0")}m
    </span>
  );
}
