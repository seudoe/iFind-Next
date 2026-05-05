"use client";

import { Sparkles, CheckCircle, AlertCircle, TrendingUp, Bookmark, Send, ChevronRight, X } from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { InternshipCard } from "@/components/internships/InternshipCard";
import { InternshipDetail } from "@/components/internships/InternshipDetail";
import { InternshipCardSkeleton } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { getStatusColor } from "@/lib/utils";
import type { User, Internship } from "@/types";
import { useEffect, useState } from "react";

interface OverviewTabProps {
  user: User;
}

const COMPLETION_CHECKLIST = [
  { key: "photo",     label: "Add profile photo",   check: (u: User) => !!u.profilePicture },
  { key: "resume",    label: "Upload resume",        check: (u: User) => !!u.resume?.driveFileId },
  { key: "parsed",    label: "Extract resume data",  check: (u: User) => !!u.resume?.parsedData },
  { key: "skills",    label: "Resume has skills",    check: (u: User) => (u.resume?.parsedData?.skills?.length ?? 0) >= 3 },
  { key: "education", label: "Resume has education", check: (u: User) => (u.resume?.parsedData?.education?.length ?? 0) > 0 },
  { key: "phone",     label: "Add phone number",     check: (u: User) => !!u.phone },
];

export function OverviewTab({ user }: OverviewTabProps) {
  const [recommended, setRecommended]       = useState<Internship[]>([]);
  const [recLoading, setRecLoading]         = useState(true);
  const [showAllRec, setShowAllRec]         = useState(false);
  const [selectedInternship, setSelectedInternship] = useState<Internship | null>(null);
  const [appliedDetails, setAppliedDetails] = useState<Map<string, Internship>>(new Map());

  // scoreMap for rendering the % badge — built from user.recommendedScores
  const scoreMap = new Map<string, number>(
    (user.recommendedScores ?? []).map(({ id, score }) => [String(id), score])
  );

  useEffect(() => {
    const ids = user.recommendedInternships;
    if (!ids || ids.length === 0) { setRecLoading(false); return; }

    // Build the score map inside the effect so it's always fresh
    const scores = new Map<string, number>(
      (user.recommendedScores ?? []).map(({ id, score }) => [String(id), score])
    );

    fetch("/api/internships/by-ids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ids }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          const sorted = (j.data as Internship[]).sort((a, b) => {
            const sa = scores.get(String(a._id)) ?? 0;
            const sb = scores.get(String(b._id)) ?? 0;
            return sb - sa;
          });
          setRecommended(sorted);
        }
      })
      .catch(() => {})
      .finally(() => setRecLoading(false));
  }, [user.recommendedInternships, user.recommendedScores]);

  // ── Fetch applied internship details ────────────────────────────────────────
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

      {/* ── Internship Detail Modal ────────────────────────────────────── */}
      <InternshipDetail
        internship={selectedInternship}
        open={!!selectedInternship}
        onClose={() => setSelectedInternship(null)}
        isApplied={user.appliedInternships.some((a) => a.internshipId === selectedInternship?._id)}
      />

      {/* ── All Recommendations Modal ──────────────────────────────────── */}
      {showAllRec && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl mt-8 mb-8">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
                <h2 className="font-semibold text-gray-900">All Recommended Internships</h2>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {recommended.length}
                </span>
              </div>
              <button
                onClick={() => setShowAllRec(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recommended.map((internship) => {
                const score = scoreMap.get(String(internship._id));
                return (
                <div key={internship._id} className="flex flex-col gap-0">
                  <InternshipCard
                    internship={internship}
                    isRecommended
                    isSaved={user.savedInternships.includes(internship._id)}
                    isApplied={user.appliedInternships.some((a) => a.internshipId === internship._id)}
                    onClick={() => setSelectedInternship(internship)}
                  />
                  {score !== undefined && (
                    <div className="flex items-center justify-center gap-1.5 py-1.5 bg-blue-50 border border-t-0 border-blue-100 rounded-b-xl text-xs font-semibold text-blue-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      {Math.round(score * 100)}% match
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Quick Stats ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Send className="h-5 w-5 text-blue-600" />}        label="Applied"       value={user.appliedInternships.length}                                             bg="bg-blue-50" />
        <StatCard icon={<Bookmark className="h-5 w-5 text-purple-600" />}  label="Saved"         value={user.savedInternships.length}                                              bg="bg-purple-50" />
        <StatCard icon={<TrendingUp className="h-5 w-5 text-green-600" />} label="Shortlisted"   value={user.appliedInternships.filter((a) => a.status === "shortlisted").length}  bg="bg-green-50" />
        <StatCard icon={<CheckCircle className="h-5 w-5 text-orange-600" />} label="Profile Score" value={`${user.profileCompletionScore}%`}                                      bg="bg-orange-50" />
      </div>

      {/* ── Profile Completion ─────────────────────────────────────────── */}
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
                {done
                  ? <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                  : <AlertCircle className="h-4 w-4 text-gray-300 flex-shrink-0" />}
                <span className={`text-sm ${done ? "text-gray-500 line-through" : "text-gray-700"}`}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Best Internships For You ───────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <h2 className="font-semibold text-gray-900">Best Internships For You</h2>
          </div>
          {recommended.length > 4 && (
            <button
              onClick={() => setShowAllRec(true)}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              View All
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>

        {recLoading ? (
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="min-w-[280px]"><InternshipCardSkeleton /></div>
            ))}
          </div>
        ) : recommended.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-xl border border-gray-200">
            <Sparkles className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No recommendations yet.</p>
            <p className="text-xs text-gray-400 mt-1">
              Upload your resume and run the recommender to see matches here.
            </p>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
        {recommended.slice(0, 4).map((internship) => {
              const score = scoreMap.get(String(internship._id));
              return (
              <div key={internship._id} className="min-w-[280px] flex flex-col gap-0">
                <InternshipCard
                  internship={internship}
                  isRecommended
                  isSaved={user.savedInternships.includes(internship._id)}
                  isApplied={user.appliedInternships.some((a) => a.internshipId === internship._id)}
                  onClick={() => setSelectedInternship(internship)}
                />
                {score !== undefined && (
                  <div className="flex items-center justify-center gap-1.5 py-1.5 bg-blue-50 border border-t-0 border-blue-100 rounded-b-xl text-xs font-semibold text-blue-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    {Math.round(score * 100)}% match
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Applied Internships ────────────────────────────────────────── */}
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
                <div key={internshipId} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200">
                  <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500 flex-shrink-0">
                    {internship?.company[0] ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{internship?.name ?? "Loading..."}</p>
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

function StatCard({ icon, label, value, bg }: {
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
