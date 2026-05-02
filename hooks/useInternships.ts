"use client";

import useSWR from "swr";
import type { Internship, InternshipFilters, PaginatedResponse } from "@/types";

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((r) => r.json());

export function useInternships(filters: Partial<InternshipFilters> = {}, page = 1) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", "12");

  if (filters.stipendType && filters.stipendType !== "any") {
    params.set("stipendType", filters.stipendType);
  }
  if (filters.stipendMin) params.set("stipendMin", String(filters.stipendMin));
  if (filters.stipendMax) params.set("stipendMax", String(filters.stipendMax));
  if (filters.workFromHome) params.set("remote", "true");
  if (filters.locations?.length) {
    filters.locations.forEach((l) => params.append("location", l));
  }
  if (filters.durationMin && filters.durationMin > 1) params.set("durationMin", String(filters.durationMin));
  if (filters.durationMax && filters.durationMax < 12) params.set("durationMax", String(filters.durationMax));
  if (filters.skills?.length) {
    filters.skills.forEach((s) => params.append("skill", s));
  }
  if (filters.companies?.length) {
    filters.companies.forEach((c) => params.append("company", c));
  }
  if (filters.perks?.length) {
    filters.perks.forEach((p) => params.append("perk", p));
  }
  if (filters.sortBy) params.set("sortBy", filters.sortBy);

  const { data, error, isLoading, mutate } = useSWR<PaginatedResponse<Internship>>(
    `/api/internships?${params.toString()}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    internships: data?.data ?? [],
    total: data?.total ?? 0,
    totalPages: data?.totalPages ?? 1,
    isLoading,
    isError: !!error,
    mutate,
  };
}

export function useInternship(id: string | null) {
  const { data, error, isLoading } = useSWR<{ success: boolean; data: Internship }>(
    id ? `/api/internships/${id}` : null,
    fetcher
  );

  return { internship: data?.data ?? null, isLoading, isError: !!error };
}

export function useRecommendedInternships() {
  // TODO: connect to recommender model for personalised ranking
  const { data, error, isLoading } = useSWR<{ success: boolean; data: Internship[] }>(
    "/api/internships/recommended",
    fetcher,
    { revalidateOnFocus: false }
  );

  return { internships: data?.data ?? [], isLoading, isError: !!error };
}
