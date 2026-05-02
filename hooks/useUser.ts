"use client";

import useSWR from "swr";
import type { User } from "@/types";

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((r) => {
    if (!r.ok) throw new Error("Not authenticated");
    return r.json();
  });

export function useUser() {
  const { data, error, isLoading, mutate } = useSWR<{ success: boolean; data: User }>(
    "/api/auth/me",
    fetcher,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );

  return {
    user: data?.data ?? null,
    isLoading,
    isError: !!error,
    isAuthenticated: !!data?.data,
    mutate,
  };
}
