import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatStipend(stipend: {
  type: string;
  amount?: number | null;
  currency?: string | null;
  period?: string | null;
}): string {
  if (stipend.type === "unpaid") return "Unpaid";
  if (stipend.type === "performance-based") return "Performance Based";
  if (stipend.amount) {
    const currency = stipend.currency || "INR";
    const symbol = currency === "INR" ? "₹" : "$";
    const period = stipend.period === "monthly" ? "/mo" : stipend.period === "weekly" ? "/wk" : "";
    return `${symbol}${stipend.amount.toLocaleString()}${period}`;
  }
  return "Paid";
}

export function formatDuration(duration: { value: number; unit: string }): string {
  return `${duration.value} ${duration.unit}`;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(dateStr);
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "applied": return "bg-blue-100 text-blue-700";
    case "shortlisted": return "bg-yellow-100 text-yellow-700";
    case "rejected": return "bg-red-100 text-red-700";
    case "selected": return "bg-green-100 text-green-700";
    default: return "bg-gray-100 text-gray-700";
  }
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
