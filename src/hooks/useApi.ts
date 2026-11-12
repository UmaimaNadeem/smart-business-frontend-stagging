"use client";
import { useCallback, useEffect, useState } from "react";
import { api, RequestOptions } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { useAuth } from "@/context/AuthContext";

/** GET a path and re-fetch when the path/query or the active workspace changes. */
export function useApi<T = unknown>(path: string | null, query?: RequestOptions["query"]) {
  const { workspaceKey } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [error, setError] = useState<string | null>(null);
  const qs = JSON.stringify(query ?? {});

  const load = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    setError(null);
    try {
      setData(await api.get<T>(path, JSON.parse(qs)));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [path, qs]);

  useEffect(() => {
    load();
  }, [load, workspaceKey]);

  return { data, loading, error, reload: load, setData };
}
