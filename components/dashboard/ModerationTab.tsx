"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Internship, User } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModerationStats {
    pendingCount: number;
    scamSuspectedCount: number;
    linkIssuesCount: number;
    autoApprovedToday: number;
    autoRejectedToday: number;
}

interface ModerationResponse {
    success: boolean;
    data: Internship[];
    total: number;
    page: number;
    totalPages: number;
    stats: ModerationStats;
}

type FilterType = "all" | "scam_suspected" | "link_issues" | "low_score";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number | null | undefined): string {
    if (score === null || score === undefined) return "text-gray-400";
    if (score >= 70) return "text-green-600 font-semibold";
    if (score >= 40) return "text-yellow-600 font-semibold";
    return "text-red-600 font-semibold";
}

function linkStatusIcon(internship: Internship): {
    icon: string;
    label: string;
} {
    const lv = internship.linkVerification;
    if (!lv || lv.reachable === null)
        return { icon: "🟡", label: "Unverified" };
    if (lv.isScamSuspected) return { icon: "⛔", label: "Scam Suspected" };
    if (lv.isExpired || !lv.reachable)
        return { icon: "🔴", label: lv.isExpired ? "Expired" : "Unreachable" };
    return { icon: "🟢", label: "Reachable" };
}

// Badge uses: "default" | "secondary" | "success" | "warning" | "danger" | "outline"
function flagVariant(flag: string): "danger" | "secondary" | "outline" {
    if (flag.includes("scam")) return "danger";
    if (flag.includes("link") || flag.includes("expired")) return "secondary";
    return "outline";
}

// ─── Reject modal ─────────────────────────────────────────────────────────────

function RejectModal({
    onConfirm,
    onCancel,
    loading,
}: {
    onConfirm: (reason: string) => void;
    onCancel: () => void;
    loading: boolean;
}) {
    const [reason, setReason] = useState("");
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm">
                <p className="font-semibold text-gray-900 mb-3">
                    Rejection reason (optional)
                </p>
                <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-400"
                    placeholder="e.g. Duplicate listing, scam suspected..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                />
                <div className="flex gap-2 justify-end">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onCancel}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="danger"
                        size="sm"
                        onClick={() => onConfirm(reason)}
                        disabled={loading}
                    >
                        {loading ? "Rejecting..." : "Confirm Reject"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
    label,
    value,
    highlight,
}: {
    label: string;
    value: number;
    highlight?: "red" | "orange" | "green";
}) {
    const colorMap = {
        red: "text-red-600",
        orange: "text-orange-500",
        green: "text-green-600",
    };
    const valueColor = highlight ? colorMap[highlight] : "text-gray-900";
    return (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ModerationTab({ user }: { user: User }) {
    const [data, setData] = useState<Internship[]>([]);
    const [stats, setStats] = useState<ModerationStats | null>(null);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filter, setFilter] = useState<FilterType>("all");
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [rejectTarget, setRejectTarget] = useState<string | null>(null);

    const fetchData = useCallback(async (p: number, f: FilterType) => {
        setLoading(true);
        try {
            const res = await fetch(
                `/api/admin/moderation?page=${p}&limit=20&filter=${f}`,
                { credentials: "include" },
            );
            const json: ModerationResponse = await res.json();
            if (json.success) {
                setData(json.data);
                setStats(json.stats);
                setTotal(json.total);
                setPage(json.page);
                setTotalPages(json.totalPages);
            }
        } catch {
            toast.error("Failed to load moderation queue");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const loadData = async () => {
            await fetchData(1, filter);
        };
        loadData();
    }, [filter, fetchData]);

    const handleApprove = async (id: string) => {
        setActionLoading(id + "_approve");
        setData((prev) => prev.filter((i) => i._id !== id));
        try {
            const res = await fetch(`/api/admin/moderation/${id}`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "approve" }),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error);
            toast.success("Internship approved");
            setStats((s) =>
                s ? { ...s, pendingCount: Math.max(0, s.pendingCount - 1) } : s,
            );
        } catch {
            toast.error("Failed to approve — reverting");
            fetchData(page, filter);
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (id: string, reason: string) => {
        setRejectTarget(null);
        setActionLoading(id + "_reject");
        setData((prev) => prev.filter((i) => i._id !== id));
        try {
            const res = await fetch(`/api/admin/moderation/${id}`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "reject", reason }),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error);
            toast.success("Internship rejected");
            setStats((s) =>
                s ? { ...s, pendingCount: Math.max(0, s.pendingCount - 1) } : s,
            );
        } catch {
            toast.error("Failed to reject — reverting");
            fetchData(page, filter);
        } finally {
            setActionLoading(null);
        }
    };

    const handleReverify = async (id: string) => {
        setActionLoading(id + "_reverify");
        try {
            const res = await fetch(`/api/admin/moderation/${id}/reverify`, {
                method: "POST",
                credentials: "include",
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error);
            setData((prev) =>
                prev.map((i) => (i._id === id ? (json.data as Internship) : i)),
            );
            toast.success("Link re-verified");
        } catch {
            toast.error("Re-verification failed");
        } finally {
            setActionLoading(null);
        }
    };

    const handleBulkReverify = async () => {
        setActionLoading("bulk_reverify");
        try {
            const res = await fetch(`/api/admin/moderation/bulk-reverify`, {
                method: "POST",
                credentials: "include",
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error);
            toast.success(
                `Re-verified ${json.processed} links, updated ${json.updated}`,
            );
            // Refresh the data
            fetchData(page, filter);
        } catch {
            toast.error("Bulk re-verification failed");
        } finally {
            setActionLoading(null);
        }
    };

    const handleApproveHighScore = async () => {
        setActionLoading("approve_high_score");
        try {
            const res = await fetch(
                `/api/admin/moderation/approve-high-score`,
                {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ threshold: 80 }),
                },
            );
            const json = await res.json();
            if (!json.success) throw new Error(json.error);
            toast.success(
                `Approved ${json.approved} internships with score >= ${json.threshold}`,
            );
            // Refresh the data
            fetchData(page, filter);
        } catch {
            toast.error("Failed to approve high score internships");
        } finally {
            setActionLoading(null);
        }
    };

    if (user.role !== "admin") {
        return (
            <div className="text-center py-16 text-gray-400">
                Access restricted to admins.
            </div>
        );
    }

    const FILTERS: { key: FilterType; label: string }[] = [
        { key: "all", label: "All" },
        { key: "scam_suspected", label: "Scam Suspected" },
        { key: "link_issues", label: "Link Issues" },
        { key: "low_score", label: "Low Score" },
    ];

    return (
        <div className="space-y-6">
            {/* Stats row */}
            {loading && !stats ? (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-16 rounded-xl" />
                    ))}
                </div>
            ) : stats ? (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <StatCard
                        label="Pending Review"
                        value={stats.pendingCount}
                    />
                    <StatCard
                        label="Scam Suspected"
                        value={stats.scamSuspectedCount}
                        highlight="red"
                    />
                    <StatCard
                        label="Link Issues"
                        value={stats.linkIssuesCount}
                        highlight="orange"
                    />
                    <StatCard
                        label="Approved Today"
                        value={stats.autoApprovedToday}
                        highlight="green"
                    />
                    <StatCard
                        label="Rejected Today"
                        value={stats.autoRejectedToday}
                    />
                </div>
            ) : null}

            {/* Filter bar */}
            <div className="flex gap-2 flex-wrap items-center">
                {FILTERS.map(({ key, label }) => (
                    <button
                        key={key}
                        onClick={() => {
                            setFilter(key);
                            setPage(1);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            filter === key
                                ? "bg-blue-600 text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                    >
                        {label}
                    </button>
                ))}
                <div className="ml-auto flex gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleBulkReverify}
                        disabled={!!actionLoading}
                        loading={actionLoading === "bulk_reverify"}
                    >
                        Re-verify All Pending
                    </Button>
                    <Button
                        size="sm"
                        variant="primary"
                        onClick={handleApproveHighScore}
                        disabled={!!actionLoading}
                        loading={actionLoading === "approve_high_score"}
                    >
                        Approve High Score (&gt;80)
                    </Button>
                </div>
                <span className="text-sm text-gray-400">{total} total</span>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="p-4 space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} className="h-14 rounded-lg" />
                        ))}
                    </div>
                ) : data.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                        No internships in this queue.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="text-left px-4 py-3 font-medium text-gray-600">
                                        Company / Role
                                    </th>
                                    <th className="text-left px-4 py-3 font-medium text-gray-600">
                                        Link
                                    </th>
                                    <th className="text-left px-4 py-3 font-medium text-gray-600">
                                        Source
                                    </th>
                                    <th className="text-left px-4 py-3 font-medium text-gray-600">
                                        Score
                                    </th>
                                    <th className="text-left px-4 py-3 font-medium text-gray-600">
                                        Flags
                                    </th>
                                    <th className="text-left px-4 py-3 font-medium text-gray-600">
                                        Link
                                    </th>
                                    <th className="text-left px-4 py-3 font-medium text-gray-600">
                                        Submitted
                                    </th>
                                    <th className="text-left px-4 py-3 font-medium text-gray-600">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {data.map((internship) => {
                                    const ls = linkStatusIcon(internship);
                                    const score =
                                        internship.moderation?.score ?? null;
                                    const flags =
                                        internship.moderation?.flags ?? [];
                                    const isActing = actionLoading?.startsWith(
                                        internship._id,
                                    );

                                    return (
                                        <tr
                                            key={internship._id}
                                            className={`hover:bg-gray-50 transition-opacity ${isActing ? "opacity-50" : ""}`}
                                        >
                                            <td className="px-4 py-3">
                                                <p className="font-medium text-gray-900 truncate max-w-[180px]">
                                                    {internship.company}
                                                </p>
                                                <p className="text-gray-500 truncate max-w-[180px]">
                                                    {internship.name}
                                                </p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <a
                                                    href={internship.applyLink}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium truncate max-w-[160px]"
                                                    title={internship.applyLink}
                                                >
                                                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                                    <span className="truncate">
                                                        {new URL(
                                                            internship.applyLink,
                                                        ).hostname.replace(
                                                            "www.",
                                                            "",
                                                        )}
                                                    </span>
                                                </a>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge
                                                    variant="outline"
                                                    className="text-xs"
                                                >
                                                    {internship.moderation
                                                        ?.source ?? "manual"}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span
                                                    className={scoreColor(
                                                        score,
                                                    )}
                                                >
                                                    {score !== null
                                                        ? score
                                                        : "—"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                    {flags.length === 0 ? (
                                                        <span className="text-gray-400">
                                                            —
                                                        </span>
                                                    ) : (
                                                        flags.map((flag) => (
                                                            <Badge
                                                                key={flag}
                                                                variant={flagVariant(
                                                                    flag,
                                                                )}
                                                                className="text-xs"
                                                            >
                                                                {flag.replace(
                                                                    /_/g,
                                                                    " ",
                                                                )}
                                                            </Badge>
                                                        ))
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span
                                                    title={
                                                        internship.linkVerification?.scamSignals?.join(
                                                            ", ",
                                                        ) || ls.label
                                                    }
                                                    className="cursor-default whitespace-nowrap"
                                                >
                                                    {ls.icon} {ls.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                                                {new Date(
                                                    internship.createdAt,
                                                ).toLocaleDateString()}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-1.5 flex-wrap">
                                                    <Button
                                                        size="sm"
                                                        variant="primary"
                                                        onClick={() =>
                                                            handleApprove(
                                                                internship._id,
                                                            )
                                                        }
                                                        disabled={
                                                            !!actionLoading
                                                        }
                                                    >
                                                        Approve
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="danger"
                                                        onClick={() =>
                                                            setRejectTarget(
                                                                internship._id,
                                                            )
                                                        }
                                                        disabled={
                                                            !!actionLoading
                                                        }
                                                    >
                                                        Reject
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() =>
                                                            handleReverify(
                                                                internship._id,
                                                            )
                                                        }
                                                        disabled={
                                                            !!actionLoading
                                                        }
                                                        loading={
                                                            actionLoading ===
                                                            internship._id +
                                                                "_reverify"
                                                        }
                                                    >
                                                        Re-verify
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchData(page - 1, filter)}
                        disabled={page <= 1 || loading}
                    >
                        Previous
                    </Button>
                    <span className="text-sm text-gray-500">
                        Page {page} of {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchData(page + 1, filter)}
                        disabled={page >= totalPages || loading}
                    >
                        Next
                    </Button>
                </div>
            )}

            {/* Reject modal */}
            {rejectTarget && (
                <RejectModal
                    onConfirm={(reason) => handleReject(rejectTarget, reason)}
                    onCancel={() => setRejectTarget(null)}
                    loading={actionLoading === rejectTarget + "_reject"}
                />
            )}
        </div>
    );
}
