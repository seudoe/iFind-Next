"use client";

import { useState } from "react";
import { LayoutGrid, List, Search } from "lucide-react";
import { InternshipCard } from "@/components/internships/InternshipCard";
import { InternshipDetail } from "@/components/internships/InternshipDetail";
import { FilterPanel } from "@/components/internships/FilterPanel";
import { InternshipCardSkeleton } from "@/components/ui/Skeleton";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useInternships } from "@/hooks/useInternships";
import { useFilters } from "@/hooks/useFilters";
import type { Internship, User } from "@/types";

interface InternshipsTabProps {
  user: User | null;
}

export function InternshipsTab({ user }: InternshipsTabProps) {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedInternship, setSelectedInternship] = useState<Internship | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { filters, updateFilter, resetFilters, toggleLocation, togglePerk, addSkill, removeSkill } =
    useFilters();

  const { internships, total, totalPages, isLoading } = useInternships(filters, page);

  const filtered = search
    ? internships.filter(
        (i) =>
          i.name.toLowerCase().includes(search.toLowerCase()) ||
          i.company.toLowerCase().includes(search.toLowerCase())
      )
    : internships;

  const handleCardClick = (internship: Internship) => {
    setSelectedInternship(internship);
    setDetailOpen(true);
  };

  return (
    <div className="flex gap-6">
      {/* Filter Panel */}
      <div className="hidden lg:block w-64 flex-shrink-0">
        <div className="sticky top-20">
          <FilterPanel
            filters={filters}
            onUpdate={updateFilter}
            onReset={resetFilters}
            onToggleLocation={toggleLocation}
            onTogglePerk={togglePerk}
            onAddSkill={addSkill}
            onRemoveSkill={removeSkill}
            userSkills={user?.skills ?? []}
          />
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1">
            <Input
              placeholder="Search by role or company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setView("grid")}
              className={`p-1.5 rounded-md transition-colors ${view === "grid" ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
              aria-label="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("list")}
              className={`p-1.5 rounded-md transition-colors ${view === "list" ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Count */}
        <p className="text-sm text-gray-500 mb-4">
          {isLoading ? "Loading..." : `${total} internships found`}
        </p>

        {/* Cards */}
        {isLoading ? (
          <div className={view === "grid" ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" : "space-y-3"}>
            {Array.from({ length: 6 }).map((_, i) => (
              <InternshipCardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <Search className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No internships match your filters.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={resetFilters}>
              Clear Filters
            </Button>
          </div>
        ) : (
          <div className={view === "grid" ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" : "space-y-3"}>
            {filtered.map((internship) => (
              <InternshipCard
                key={internship._id}
                internship={internship}
                view={view}
                isSaved={user?.savedInternships.includes(internship._id) ?? false}
                isApplied={user?.appliedInternships.some((a) => a.internshipId === internship._id) ?? false}
                onClick={() => handleCardClick(internship)}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <InternshipDetail
        internship={selectedInternship}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        isApplied={
          selectedInternship
            ? user?.appliedInternships.some((a) => a.internshipId === selectedInternship._id) ?? false
            : false
        }
      />
    </div>
  );
}
