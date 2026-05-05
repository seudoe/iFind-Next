"use client";

import { useState } from "react";
import {
    MapPin,
    Clock,
    IndianRupee,
    Bookmark,
    BookmarkCheck,
    ExternalLink,
    Wifi,
    Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { Internship } from "@/types";
import { formatStipend, formatDuration, formatDate, cn } from "@/lib/utils";
import { toast } from "sonner";

interface InternshipCardProps {
    internship: Internship;
    view?: "grid" | "list";
    isSaved?: boolean;
    isApplied?: boolean;
    isRecommended?: boolean;
    onSave?: (id: string) => void;
    onApply?: (id: string) => void;
    onClick?: () => void;
}

export function InternshipCard({
    internship,
    view = "grid",
    isSaved = false,
    isApplied = false,
    isRecommended = false,
    onSave,
    onApply,
    onClick,
}: InternshipCardProps) {
    const [saved, setSaved] = useState(isSaved);
    const [applying, setApplying] = useState(false);

    const handleSave = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const next = !saved;
        setSaved(next);

        try {
            const res = await fetch(`/api/internships/${internship._id}/save`, {
                method: next ? "POST" : "DELETE",
                credentials: "include",
            });

            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error || "Failed to save");
            }

            onSave?.(internship._id);
            toast.success(next ? "Saved to your list" : "Removed from saved");
        } catch (error) {
            setSaved(!next); // revert on error
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to save internship",
            );
            console.error("Save error:", error);
        }
    };

    const handleApply = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isApplied) return;
        setApplying(true);
        try {
            const res = await fetch(
                `/api/internships/${internship._id}/apply`,
                {
                    method: "POST",
                    credentials: "include",
                },
            );
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            onApply?.(internship._id);
            toast.success("Application submitted!");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to apply");
        } finally {
            setApplying(false);
        }
    };

    const location = internship.isRemote
        ? "Work from Home"
        : [internship.city, internship.state].filter(Boolean).join(", ") ||
          (internship as Internship & { location?: string }).location ||
          internship.country ||
          "India";

    const deadlineSoon =
        internship.deadlineDate &&
        new Date(internship.deadlineDate).getTime() - Date.now() < 7 * 86400000;

    if (view === "list") {
        return (
            <div
                onClick={onClick}
                className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
            >
                {/* Company Logo */}
                <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-lg font-bold text-gray-500 group-hover:bg-blue-50">
                    {internship.company[0]}
                </div>

                {/* Main Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <h3 className="font-semibold text-gray-900 text-sm group-hover:text-blue-600 transition-colors line-clamp-1">
                                {internship.name}
                            </h3>
                            <p className="text-sm text-gray-500">
                                {internship.company}
                            </p>
                        </div>
                        {isRecommended && (
                            <Badge
                                variant="default"
                                className="flex-shrink-0 flex items-center gap-1"
                            >
                                <Sparkles className="h-3 w-3" /> AI Pick
                            </Badge>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {location}
                        </span>
                        <span className="flex items-center gap-1">
                            <IndianRupee className="h-3 w-3" />
                            {formatStipend(internship.stipend)}
                        </span>
                        <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(internship.duration)}
                        </span>
                    </div>
                </div>

                {/* Skills */}
                <div className="hidden lg:flex flex-wrap gap-1 max-w-[200px]">
                    {internship.skills.slice(0, 3).map((skill) => (
                        <Badge
                            key={skill}
                            variant="secondary"
                            className="text-xs"
                        >
                            {skill}
                        </Badge>
                    ))}
                </div>

                {/* Deadline */}
                <div className="hidden md:block text-xs text-right flex-shrink-0">
                    {internship.deadlineDate ? (
                        <span
                            className={cn(
                                deadlineSoon
                                    ? "text-red-600 font-medium"
                                    : "text-gray-500",
                            )}
                        >
                            {deadlineSoon ? "⚡ " : ""}Deadline:{" "}
                            {formatDate(internship.deadlineDate)}
                        </span>
                    ) : (
                        <span className="text-gray-400">No deadline</span>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                        onClick={handleSave}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        aria-label={saved ? "Unsave" : "Save"}
                    >
                        {saved ? (
                            <BookmarkCheck className="h-4 w-4 text-blue-600" />
                        ) : (
                            <Bookmark className="h-4 w-4" />
                        )}
                    </button>
                    <Button
                        size="sm"
                        variant={isApplied ? "secondary" : "primary"}
                        onClick={handleApply}
                        loading={applying}
                        disabled={isApplied}
                    >
                        {isApplied ? "Applied" : "Apply"}
                    </Button>
                </div>
            </div>
        );
    }

    // Grid view
    return (
        <div
            onClick={onClick}
            className="bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer group flex flex-col"
        >
            <div className="p-5 flex-1">
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-start gap-3">
                        <div className="h-11 w-11 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-base font-bold text-gray-500 group-hover:bg-blue-50 transition-colors">
                            {internship.company[0]}
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900 text-sm leading-tight group-hover:text-blue-600 transition-colors line-clamp-2">
                                {internship.name}
                            </h3>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {internship.company}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleSave}
                        className="p-1 rounded-lg text-gray-300 hover:text-blue-600 hover:bg-blue-50 transition-colors flex-shrink-0"
                        aria-label={saved ? "Unsave" : "Save"}
                    >
                        {saved ? (
                            <BookmarkCheck className="h-4 w-4 text-blue-600" />
                        ) : (
                            <Bookmark className="h-4 w-4" />
                        )}
                    </button>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                    {internship.isRemote && (
                        <Badge
                            variant="success"
                            className="flex items-center gap-1"
                        >
                            <Wifi className="h-3 w-3" /> Remote
                        </Badge>
                    )}
                    {isRecommended && (
                        <Badge
                            variant="default"
                            className="flex items-center gap-1"
                        >
                            <Sparkles className="h-3 w-3" /> AI Pick
                        </Badge>
                    )}
                    {deadlineSoon && (
                        <Badge variant="warning">⚡ Closing soon</Badge>
                    )}
                </div>

                {/* Details */}
                <div className="space-y-1.5 text-xs text-gray-500">
                    <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{location}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <IndianRupee className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>{formatStipend(internship.stipend)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>{formatDuration(internship.duration)}</span>
                    </div>
                </div>

                {/* Skills */}
                <div className="flex flex-wrap gap-1 mt-3">
                    {internship.skills.slice(0, 3).map((skill) => (
                        <Badge
                            key={skill}
                            variant="secondary"
                            className="text-xs"
                        >
                            {skill}
                        </Badge>
                    ))}
                    {internship.skills.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                            +{internship.skills.length - 3}
                        </Badge>
                    )}
                </div>

                {/* Deadline */}
                {internship.deadlineDate && (
                    <p
                        className={cn(
                            "text-xs mt-2",
                            deadlineSoon
                                ? "text-red-600 font-medium"
                                : "text-gray-400",
                        )}
                    >
                        Deadline: {formatDate(internship.deadlineDate)}
                    </p>
                )}
            </div>

            {/* Actions */}
            <div className="px-5 pb-4 flex gap-2">
                <Button
                    size="sm"
                    variant={isApplied ? "secondary" : "primary"}
                    className="flex-1"
                    onClick={handleApply}
                    loading={applying}
                    disabled={isApplied}
                >
                    {isApplied ? "Applied ✓" : "Apply Now"}
                </Button>
                <a
                    href={internship.applyLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
                    aria-label="Open original listing"
                >
                    <ExternalLink className="h-4 w-4" />
                </a>
            </div>
        </div>
    );
}
