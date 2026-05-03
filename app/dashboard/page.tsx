"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Menu, X, Briefcase } from "lucide-react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { OverviewTab } from "@/components/dashboard/OverviewTab";
import { InternshipsTab } from "@/components/dashboard/InternshipsTab";
import { ResumeTab } from "@/components/dashboard/ResumeTab";
import { ProfileTab } from "@/components/dashboard/ProfileTab";
import { ModerationTab } from "@/components/dashboard/ModerationTab";
import { InternshipCard } from "@/components/internships/InternshipCard";
import {
    ProfileSkeleton,
    InternshipCardSkeleton,
} from "@/components/ui/Skeleton";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";
import Link from "next/link";
import type { Internship, User } from "@/types";

function DashboardContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const activeTab = searchParams.get("tab") || "overview";
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    const { user, isLoading } = useUser();

    const handleLogout = async () => {
        await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "include",
        });
        toast.success("Logged out successfully");
        router.push("/");
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="w-full max-w-sm p-8">
                    <ProfileSkeleton />
                </div>
            </div>
        );
    }

    if (!user) {
        // Allow browsing internships without login — redirect only for protected tabs
        if (activeTab === "internships") {
            return <PublicInternshipsView />;
        }
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-gray-600 mb-4">
                        Please log in to access your dashboard.
                    </p>
                    <Link
                        href="/login"
                        className="text-blue-600 font-medium hover:underline"
                    >
                        Go to Login
                    </Link>
                </div>
            </div>
        );
    }

    const TAB_TITLES: Record<string, string> = {
        overview: "Overview",
        internships: "Browse Internships",
        resume: "My Resume",
        profile: "My Profile",
        saved: "Saved Internships",
        moderation: "Moderation",
    };

    return (
        // h-screen + overflow-hidden on the root: the page itself never scrolls.
        // Only the <main> column scrolls independently.
        <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
            {/* ── Mobile Top Bar ─────────────────────────────────────────── */}
            <div className="lg:hidden flex-shrink-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center">
                        <Briefcase className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="font-bold text-blue-600">iFind</span>
                </Link>
                <span className="font-semibold text-gray-900 text-sm">
                    {TAB_TITLES[activeTab]}
                </span>
                <button
                    onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
                    className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
                    aria-label="Toggle sidebar"
                >
                    {mobileSidebarOpen ? (
                        <X className="h-5 w-5" />
                    ) : (
                        <Menu className="h-5 w-5" />
                    )}
                </button>
            </div>

            {/* ── Body row: sidebar + main ────────────────────────────────── */}
            {/* flex-1 + min-h-0 lets this row fill remaining height without overflow */}
            <div className="flex flex-1 min-h-0">
                {/* Desktop Sidebar — full height, never scrolls with content */}
                <div className="hidden lg:flex flex-shrink-0 h-full">
                    <Sidebar user={user} onLogout={handleLogout} />
                </div>

                {/* Mobile Sidebar Overlay */}
                {mobileSidebarOpen && (
                    <div className="lg:hidden fixed inset-0 z-40 flex">
                        <div
                            className="absolute inset-0 bg-black/50"
                            onClick={() => setMobileSidebarOpen(false)}
                        />
                        <div className="relative z-50 w-64 h-full">
                            <Sidebar user={user} onLogout={handleLogout} />
                        </div>
                    </div>
                )}

                {/* Main Content — this is the ONLY thing that scrolls */}
                <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
                    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
                        {/* Page Title (desktop) */}
                        <div className="hidden lg:flex items-center justify-between mb-6">
                            <h1 className="text-xl font-bold text-gray-900">
                                {TAB_TITLES[activeTab]}
                            </h1>
                        </div>

                        {/* Tab Content */}
                        {activeTab === "overview" && (
                            <OverviewTab user={user} />
                        )}
                        {activeTab === "internships" && (
                            <InternshipsTab user={user} />
                        )}
                        {activeTab === "resume" && <ResumeTab user={user} />}
                        {activeTab === "profile" && <ProfileTab user={user} />}
                        {activeTab === "saved" && user && (
                            <SavedTab user={user} />
                        )}
                        {activeTab === "moderation" &&
                            user?.role === "admin" && (
                                <ModerationTab user={user} />
                            )}
                    </div>
                </main>
            </div>

            {/* ── Mobile Bottom Nav ───────────────────────────────────────── */}
            <nav className="lg:hidden flex-shrink-0 z-30 bg-white border-t border-gray-200 flex">
                {[
                    { tab: "overview", label: "Home", emoji: "🏠" },
                    { tab: "internships", label: "Search", emoji: "🔍" },
                    { tab: "resume", label: "Resume", emoji: "📄" },
                    { tab: "profile", label: "Profile", emoji: "👤" },
                    { tab: "saved", label: "Saved", emoji: "🔖" },
                ].map(({ tab, label, emoji }) => (
                    <Link
                        key={tab}
                        href={`/dashboard?tab=${tab}`}
                        className={`flex-1 flex flex-col items-center py-2 text-xs transition-colors ${
                            activeTab === tab
                                ? "text-blue-600"
                                : "text-gray-500"
                        }`}
                    >
                        <span className="text-lg">{emoji}</span>
                        <span className="mt-0.5">{label}</span>
                    </Link>
                ))}
            </nav>
        </div>
    );
}

// Saved tab — fetches real saved internships from API
function SavedTab({ user }: { user: User }) {
    const [internships, setInternships] = useState<Internship[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user.savedInternships.length) {
            setLoading(false);
            return;
        }
        // Fetch each saved internship by ID in parallel
        Promise.all(
            user.savedInternships.map((id) =>
                fetch(`/api/internships/${id}`, { credentials: "include" })
                    .then((r) => r.json())
                    .then((j) => j.data as Internship)
                    .catch(() => null),
            ),
        ).then((results) => {
            setInternships(results.filter(Boolean) as Internship[]);
            setLoading(false);
        });
    }, [user.savedInternships]);

    if (loading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                    <InternshipCardSkeleton key={i} />
                ))}
            </div>
        );
    }

    return (
        <div>
            <p className="text-sm text-gray-500 mb-4">
                {internships.length} saved internships
            </p>
            {internships.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                    <p className="text-gray-400">No saved internships yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {internships.map((internship) => (
                        <InternshipCard
                            key={internship._id}
                            internship={internship}
                            isSaved={true}
                            isApplied={user.appliedInternships.some(
                                (a) => a.internshipId === internship._id,
                            )}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// Public internships view — no auth required, just browsing
function PublicInternshipsView() {
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center">
                        <Briefcase className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="font-bold text-blue-600">iFind</span>
                </Link>
                <div className="flex items-center gap-3">
                    <Link
                        href="/login"
                        className="text-sm text-blue-600 font-medium hover:underline"
                    >
                        Login
                    </Link>
                    <Link
                        href="/register"
                        className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Register
                    </Link>
                </div>
            </div>
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                    <p className="text-sm text-blue-700">
                        <strong>Sign in</strong> to apply, save internships, and
                        get AI-powered recommendations.
                    </p>
                    <Link
                        href="/login"
                        className="text-sm font-medium text-blue-700 underline ml-4 flex-shrink-0"
                    >
                        Login →
                    </Link>
                </div>
                {/* Reuse InternshipsTab but without user-specific features */}
                <InternshipsTab user={null as unknown as User} />
            </div>
        </div>
    );
}

export default function DashboardPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                    <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full" />
                </div>
            }
        >
            <DashboardContent />
        </Suspense>
    );
}
