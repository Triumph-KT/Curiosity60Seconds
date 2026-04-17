"use client";

import { useEffect } from "react";

export function PresencePinger() {
  useEffect(() => {
    const ping = async () => {
      try {
        await fetch("/api/presence", { method: "POST" });
      } catch {
        // ignore
      }
    };
    void ping();
    const id = window.setInterval(ping, 60000);
    return () => window.clearInterval(id);
  }, []);
  return null;
}
