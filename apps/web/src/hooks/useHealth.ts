import { useState, useEffect } from "react";

const API_URL = import.meta.env.VITE_API_URL ?? "";

export type ModelStatus = "loading" | "online" | "offline";

export interface Health {
  status: ModelStatus;
  version: string | null;
}

export function useHealth(): Health {
  const [health, setHealth] = useState<Health>({ status: "loading", version: null });

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/health`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setHealth({
            status: data.modelLoaded ? "online" : "offline",
            version: data.version ?? null,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setHealth({ status: "offline", version: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return health;
}
