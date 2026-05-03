"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
    LayoutDashboard,
    Briefcase,
    FileText,
    User,
    Bookmark,
    LogOut,
    ChevronRight,
    ShieldCheck,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/lib/utils";
import type { User as UserType } from "@/types";

interface SidebarProps {
    user: UserType;
    onLogout?: () => void;
}

const NAV_ITEMS = [
    { tab: "overview", label: "Overview", icon: LayoutDashboard },
    { tab: "internships", label: "Internships", icon: Briefcase },
    { tab: "resume", label: "Resume", icon: FileText },
    { tab: "profile", label: "Profile", icon: User },
    { tab: "saved", label: "Saved", icon: Bookmark },
];

const ADMIN_NAV_ITEMS = [
    { tab: "moderation", label: "Moderation", icon: ShieldCheck },
];

export function Sidebar({ user, onLogout }: SidebarProps) {
    const searchParams = useSearchParams();
    const activeTab = searchParams.get("tab") || "overview";

    return (
        <aside className="w-64 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full">
            {/* User Info */}
            <div className="p-5 border-b border-gray-100">
                <div className="flex items-center gap-3 mb-3">
                    <Avatar
                        src={user.profilePicture}
                        name={user.name}
                        size="md"
                    />
                    <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">
                            {user.name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                            @{user.username}
                        </p>
                    </div>
                </div>
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500">
                            Profile Completion
                        </span>
                        <span className="text-xs font-semibold text-blue-600">
                            {user.profileCompletionScore}%
                        </span>
                    </div>
                    <ProgressBar value={user.profileCompletionScore} />
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
                {NAV_ITEMS.map(({ tab, label, icon: Icon }) => (
                    <Link
                        key={tab}
                        href={`/dashboard?tab=${tab}`}
                        className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group",
                            activeTab === tab
                                ? "bg-blue-50 text-blue-700"
                                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                        )}
                    >
                        <Icon
                            className={cn(
                                "h-4 w-4",
                                activeTab === tab
                                    ? "text-blue-600"
                                    : "text-gray-400 group-hover:text-gray-600",
                            )}
                        />
                        <span className="flex-1">{label}</span>
                        {activeTab === tab && (
                            <ChevronRight className="h-3 w-3 text-blue-400" />
                        )}
                    </Link>
                ))}

                {/* Admin-only nav items */}
                {user.role === "admin" && (
                    <>
                        <div className="my-2 border-t border-gray-100" />
                        {ADMIN_NAV_ITEMS.map(({ tab, label, icon: Icon }) => (
                            <Link
                                key={tab}
                                href={`/dashboard?tab=${tab}`}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group",
                                    activeTab === tab
                                        ? "bg-blue-50 text-blue-700"
                                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                                )}
                            >
                                <Icon
                                    className={cn(
                                        "h-4 w-4",
                                        activeTab === tab
                                            ? "text-blue-600"
                                            : "text-gray-400 group-hover:text-gray-600",
                                    )}
                                />
                                <span className="flex-1">{label}</span>
                                {activeTab === tab && (
                                    <ChevronRight className="h-3 w-3 text-blue-400" />
                                )}
                            </Link>
                        ))}
                    </>
                )}
            </nav>

            {/* Logout */}
            <div className="p-3 border-t border-gray-100">
                <button
                    onClick={onLogout}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors w-full"
                >
                    <LogOut className="h-4 w-4" />
                    Logout
                </button>
            </div>
        </aside>
    );
}
