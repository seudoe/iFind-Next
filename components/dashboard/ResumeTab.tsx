"use client";

import { useState, useRef } from "react";
import {
  Upload, FileText, RefreshCw, Sparkles,
  CheckCircle, AlertCircle, Trash2, Download, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import type { User } from "@/types";

interface ResumeTabProps {
  user: User;
  onResumeUpdate?: () => void;
}

export function ResumeTab({ user, onResumeUpdate }: ResumeTabProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [localResume, setLocalResume] = useState(user.resume);
  const fileRef = useRef<HTMLInputElement>(null);

  const hasResume = !!localResume?.driveViewLink;

  const handleFile = async (file: File) => {
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are accepted.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be under 5MB.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("resume", file);

      const res = await fetch("/api/user/resume", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");

      // Update local state immediately — no need to refetch the whole user
      setLocalResume({
        driveFileId: json.data.driveFileId,
        driveViewLink: json.data.driveViewLink,
        uploadedAt: json.data.uploadedAt,
        extractedSkills: localResume?.extractedSkills ?? [],
      });

      toast.success("Resume uploaded successfully!");
      onResumeUpdate?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      // Reset file input so the same file can be re-selected
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    if (!confirm("Remove your resume? This will delete it from Google Drive.")) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/user/resume", {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setLocalResume({ driveFileId: null, driveViewLink: null, uploadedAt: null, extractedSkills: [] });
      toast.success("Resume removed.");
      onResumeUpdate?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete resume");
    } finally {
      setDeleting(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Resume</h2>
        <p className="text-sm text-gray-500 mt-1">
          Upload your resume in PDF format. It will be stored in Google Drive.
        </p>
      </div>

      {/* ── Upload Zone ─────────────────────────────────────────────── */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileRef.current?.click()}
        className={[
          "relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all",
          dragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-400 hover:bg-gray-50",
          uploading ? "pointer-events-none opacity-60" : "",
        ].join(" ")}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
              <Upload className="h-6 w-6 text-blue-600 animate-bounce" />
            </div>
            <p className="text-sm font-medium text-blue-600">Uploading to Google Drive…</p>
            <p className="text-xs text-gray-400">This may take a few seconds</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
              <Upload className="h-6 w-6 text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">
                {hasResume ? "Drop a new PDF to replace your resume" : "Drag & drop your resume here"}
              </p>
              <p className="text-xs text-gray-400 mt-1">or click to browse — PDF only, max 5MB</p>
            </div>
            <Button variant="outline" size="sm" type="button">
              {hasResume ? "Replace Resume" : "Choose File"}
            </Button>
          </div>
        )}
      </div>

      {/* ── Current Resume Card ──────────────────────────────────────── */}
      {hasResume ? (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          {/* Header row */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                <FileText className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">Resume.pdf</p>
                <p className="text-xs text-gray-500">
                  Uploaded {formatDate(localResume.uploadedAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-xs text-green-600 font-medium">Stored in Drive</span>
            </div>
          </div>

          {/* Preview iframe */}
          <div className="rounded-lg border border-gray-200 overflow-hidden bg-gray-50" style={{ height: 480 }}>
            <iframe
              src={localResume.driveViewLink!}
              className="w-full h-full"
              title="Resume Preview"
              allow="autoplay"
            />
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <a
              href={localResume.driveViewLink!}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <ExternalLink className="h-3.5 w-3.5" />
                Open PDF
              </Button>
            </a>
            <a
              href={`/api/user/resume/download/${localResume.driveFileId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <Download className="h-3.5 w-3.5" />
                Download
              </Button>
            </a>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              onClick={() => fileRef.current?.click()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Re-upload
            </Button>
            <Button
              variant="danger"
              size="sm"
              className="flex items-center gap-2 ml-auto"
              loading={deleting}
              onClick={handleDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-6 text-center">
          <AlertCircle className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No resume uploaded yet.</p>
          <p className="text-xs text-gray-400 mt-1">
            Upload your resume to improve your profile score and enable skill extraction.
          </p>
        </div>
      )}

      {/* ── Extracted Skills ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-blue-600" />
          <h3 className="font-semibold text-gray-900 text-sm">Extracted Skills</h3>
          <Badge variant="default" className="text-xs">AI</Badge>
        </div>

        {/* TODO: connect to skills extractor model */}
        {localResume?.extractedSkills && localResume.extractedSkills.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {localResume.extractedSkills.map((skill) => (
              <Badge key={skill} variant="secondary">{skill}</Badge>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-gray-500">
              {hasResume
                ? "Skill extraction will be available once the AI model is connected."
                : "Upload your resume to enable automatic skill extraction."}
            </p>
            <div className="flex flex-wrap gap-2 opacity-30 pointer-events-none">
              {["React", "TypeScript", "Node.js", "Python", "SQL"].map((s) => (
                <Skeleton key={s} className="h-6 w-16 rounded-full" />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
