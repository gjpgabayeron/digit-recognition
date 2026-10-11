import { useState, useEffect, useCallback } from "react";

const API_URL = import.meta.env.VITE_API_URL ?? "";
const OFFLINE_POLL_MS = 15000;

export type ModelStatus = "loading" | "online" | "offline";

export interface Health {
  status: ModelStatus;
  version: string | null;
  params: number | null;
  retry: () => void;
}

async function checkHealth(signal?: AbortSignal): Promise<Omit<Health, "retry">> {
  try {
    const res = await fetch(`${API_URL}/health`, { signal });
    if (!res.ok) return { status: "offline", version: null, params: null };
    const data = await res.json().catch(() => ({}));
    return {
      status: data.modelLoaded ? "online" : "offline",
      version: data.version ?? null,
      params: typeof data.params === "number" ? data.params : null,
    };
  } catch {
    return { status: "offline", version: null, params: null };
  }
}

export function useHealth(): Health {
  const [health, setHealth] = useState<Omit<Health, "retry">>({
    status: "loading",
    version: null,
    params: null,
  });

  const retry = useCallback(() => {
    setHealth((h) =>
      h.status === "online" ? h : { status: "loading", version: null, params: null }
    );
    checkHealth().then(setHealth);
  }, []);

  useEffect(() => {
    let cancelled = false;
    checkHealth().then((next) => {
      if (!cancelled) setHealth(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (health.status !== "offline") return;
    const id = window.setInterval(() => {
      checkHealth().then(setHealth);
    }, OFFLINE_POLL_MS);
    return () => window.clearInterval(id);
  }, [health.status]);

  return { ...health, retry };
}
