"use client";

import { Sparkles, CheckCircle, AlertCircle, TrendingUp, Bookmark, Send } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { InternshipCard } from "@/components/internships/InternshipCard";
import { Skeleton, InternshipCardSkeleton } from "@/components/ui/Skeleton";
import { useRecommendedInternships } from "@/hooks/useInternships";
import { getStatusColor } from "@/lib/utils";
import type { User, Internship } from "@/types";
import { useEffect, useState } from "react";

interface OverviewTabProps {
  user: User;
}

const COMPLETION_CHECKLIST = [
  { key: "photo", label: "Add profile photo", check: (u: User) => !!u.profilePicture },
  { key: "resume", label: "Upload resume", check: (u: User) => !!u.resume?.driveFileId },
  { key: "skills", label: "Add at least 3 skills", check: (u: User) => u.skills.length >= 3 },
  { key: "education", label: "Add education details", check: (u: User) => u.education.length > 0 },
  { key: "experience", label: "Add work experience", check: (u: User) => u.experiences.length > 0 },
  { key: "phone", label: "Add phone number", check: (u: User) => !!u.phone },
];

export function OverviewTab({ user }: OverviewTabProps) {
  // TODO: connect to recommender model
  const { internships: recommended, isLoading: recLoading } = useRecommendedInternships();

  // Fetch internship details for applied list
  const [appliedDetails, setAppliedDetails] = useState<Map<string, Internship>>(new Map());
  useEffect(() => {
    if (!user.appliedInternships.length) return;
    Promise.all(
      user.appliedInternships.map((a) =>
        fetch(`/api/internships/${a.internshipId}`, { credentials: "include" })
          .then((r) => r.json())
          .then((j) => j.data as Internship)
          .catch(() => null)
      )
    ).then((results) => {
      const map = new Map<string, Internship>();
      results.forEach((r) => { if (r) map.set(r._id, r); });
      setAppliedDetails(map);
    });
  }, [user.appliedInternships]);

  return (
    <div className="space-y-8">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Send className="h-5 w-5 text-blue-600" />}
          label="Applied"
          value={user.appliedInternships.length}
          bg="bg-blue-50"
        />
        <StatCard
          icon={<Bookmark className="h-5 w-5 text-purple-600" />}
          label="Saved"
          value={user.savedInternships.length}
          bg="bg-purple-50"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-green-600" />}
          label="Shortlisted"
          value={user.appliedInternships.filter((a) => a.status === "shortlisted").length}
          bg="bg-green-50"
        />
        <StatCard
          icon={<CheckCircle className="h-5 w-5 text-orange-600" />}
          label="Profile Score"
          value={`${user.profileCompletionScore}%`}
          bg="bg-orange-50"
        />
      </div>

      {/* Profile Completion */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Profile Completion</h2>
          <span className="text-2xl font-bold text-blue-600">{user.profileCompletionScore}%</span>
        </div>
        <ProgressBar value={user.profileCompletionScore} showLabel={false} className="mb-5" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {COMPLETION_CHECKLIST.map(({ key, label, check }) => {
            const done = check(user);
            return (
              <div key={key} className="flex items-center gap-2.5">
                {done ? (
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-gray-300 flex-shrink-0" />
                )}
                <span className={`text-sm ${done ? "text-gray-500 line-through" : "text-gray-700"}`}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recommended Internships */}
      {/* TODO: connect to recommender model */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-blue-600" />
          <h2 className="font-semibold text-gray-900">Best Internships For You</h2>
          <Badge variant="default" className="text-xs">AI Powered</Badge>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
          {recLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="min-w-[280px]">
                  <InternshipCardSkeleton />
                </div>
              ))
            : recommended.slice(0, 5).map((internship) => (
                <div key={internship._id} className="min-w-[280px]">
                  <InternshipCard
                    internship={internship}
                    isRecommended
                    isSaved={user.savedInternships.includes(internship._id)}
                    isApplied={user.appliedInternships.some((a) => a.internshipId === internship._id)}
                  />
                </div>
              ))}
        </div>
      </div>

      {/* Applied Internships */}
      <div>
        <h2 className="font-semibold text-gray-900 mb-4">Your Applications</h2>
        {user.appliedInternships.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-xl border border-gray-200">
            <Send className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No applications yet. Start applying!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {user.appliedInternships.map(({ internshipId, appliedAt, status }) => {
              const internship = appliedDetails.get(internshipId);
              return (
                <div
                  key={internshipId}
                  className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200"
                >
                  <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500 flex-shrink-0">
                    {internship?.company[0] ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">
                      {internship?.name ?? "Loading..."}
                    </p>
                    <p className="text-xs text-gray-500">{internship?.company ?? ""}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <Badge className={getStatusColor(status)}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Badge>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(appliedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  bg: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className={`inline-flex p-2 rounded-lg ${bg} mb-3`}>{icon}</div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
