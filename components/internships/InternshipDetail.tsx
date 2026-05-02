"use client";

import { MapPin, Clock, IndianRupee, Calendar, Users, ExternalLink, CheckCircle, Wifi, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { Internship } from "@/types";
import { formatStipend, formatDuration, formatDate } from "@/lib/utils";

interface InternshipDetailProps {
  internship: Internship | null;
  open: boolean;
  onClose: () => void;
  isApplied?: boolean;
  isSaved?: boolean;
  onApply?: (id: string) => void;
  onSave?: (id: string) => void;
}

export function InternshipDetail({
  internship,
  open,
  onClose,
  isApplied = false,
  onApply,
}: InternshipDetailProps) {
  if (!internship) return null;

  const location = internship.isRemote
    ? "Work from Home"
    : [internship.city, internship.state, internship.country].filter(Boolean).join(", ")
      || (internship as Internship & { location?: string }).location
      || "India";

  return (
    <Modal open={open} onClose={onClose} size="xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-xl bg-gray-100 flex items-center justify-center text-2xl font-bold text-gray-500 flex-shrink-0">
            {internship.company[0]}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900">{internship.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Building2 className="h-4 w-4 text-gray-400" />
              <span className="text-gray-600 font-medium">{internship.company}</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {internship.isRemote && (
                <Badge variant="success" className="flex items-center gap-1">
                  <Wifi className="h-3 w-3" /> Remote
                </Badge>
              )}
              {internship.perks?.map((perk) => (
                <Badge key={perk} variant="secondary">{perk}</Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={<IndianRupee className="h-4 w-4 text-green-600" />} label="Stipend" value={formatStipend(internship.stipend)} />
          <StatCard icon={<Clock className="h-4 w-4 text-blue-600" />} label="Duration" value={formatDuration(internship.duration)} />
          <StatCard icon={<MapPin className="h-4 w-4 text-purple-600" />} label="Location" value={location || "India"} />
          {internship.openings && (
            <StatCard icon={<Users className="h-4 w-4 text-orange-600" />} label="Openings" value={`${internship.openings} seats`} />
          )}
        </div>

        {/* Deadline */}
        {internship.deadlineDate && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <Calendar className="h-4 w-4 text-yellow-600" />
            <span className="text-sm text-yellow-800">
              <strong>Application Deadline:</strong> {formatDate(internship.deadlineDate)}
            </span>
          </div>
        )}

        {/* About */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">About the Internship</h3>
          <p className="text-sm text-gray-600 leading-relaxed">{internship.summary}</p>
        </div>

        {/* Responsibilities */}
        {internship.responsibilities && internship.responsibilities.length > 0 && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Responsibilities</h3>
            <ul className="space-y-1.5">
              {internship.responsibilities.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Skills Required */}
        {internship.skills.length > 0 && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Skills Required</h3>
            <div className="flex flex-wrap gap-2">
              {internship.skills.map((skill) => (
                <Badge key={skill} variant="secondary">{skill}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Eligibility */}
        {(internship.degree || internship.field) && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Eligibility</h3>
            <div className="text-sm text-gray-600 space-y-1">
              {internship.degree && (
                <p><strong>Degree:</strong> {internship.degree.join(", ")}</p>
              )}
              {internship.field && (
                <p><strong>Field:</strong> {internship.field.join(", ")}</p>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <Button
            variant={isApplied ? "secondary" : "primary"}
            className="flex-1"
            disabled={isApplied}
            onClick={() => onApply?.(internship._id)}
          >
            {isApplied ? "Already Applied ✓" : "Apply Now"}
          </Button>
          <a
            href={internship.applyLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              Original Listing
            </Button>
          </a>
        </div>
      </div>
    </Modal>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className="text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}
