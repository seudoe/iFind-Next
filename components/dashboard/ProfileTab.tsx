"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, AlertTriangle, Camera, Eye, EyeOff, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TagInput } from "@/components/ui/TagInput";
import { Avatar } from "@/components/ui/Avatar";
import { toast } from "sonner";
import type { User, Education, Experience } from "@/types";

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

interface ProfileTabProps {
  user: User;
  onUpdate?: () => void;
}

export function ProfileTab({ user, onUpdate }: ProfileTabProps) {
  const [skills, setSkills] = useState<string[]>(user.skills);
  const [education, setEducation] = useState<Education[]>(user.education);
  const [experiences, setExperiences] = useState<Experience[]>(user.experiences);
  const [saving, setSaving] = useState(false);
  const [savingEdu, setSavingEdu] = useState(false);
  const [savingExp, setSavingExp] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // Photo state
  const [photoUrl, setPhotoUrl] = useState<string | null>(user.profilePicture ?? null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // ── Shared save helper ──────────────────────────────────────────
  const saveToMongo = async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/user/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Save failed");
    return json;
  };

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user.name,
      phone: user.phone ?? "",
      city: user.city ?? "",
      state: user.state ?? "",
      country: user.country ?? "",
    },
  });

  const {
    register: regPw,
    handleSubmit: handlePwSubmit,
    formState: { errors: pwErrors },
    reset: resetPw,
  } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  const watchedName = watch("name");

  // Name mismatch warning — compare with resume name if available
  // TODO: connect to resume name extraction model
  const resumeName: string | null = null;
  const nameMismatch =
    resumeName &&
    watchedName &&
    (resumeName as string).toLowerCase().trim() !== watchedName.toLowerCase().trim();

  const onSaveProfile = async (data: ProfileForm) => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, skills }),
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success("Profile updated successfully!");
      onUpdate?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const onChangePassword = async (data: PasswordForm) => {
    try {
      const res = await fetch("/api/user/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: data.currentPassword, newPassword: data.newPassword }),
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success("Password changed successfully!");
      resetPw();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change password");
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Only JPG, PNG, GIF, or WebP images are accepted.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB.");
      return;
    }

    setPhotoUploading(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch("/api/user/photo", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setPhotoUrl(json.data.photoUrl);
      toast.success("Profile photo updated!");
      onUpdate?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Photo upload failed");
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const handlePhotoRemove = async () => {
    try {
      const res = await fetch("/api/user/photo", { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error();
      setPhotoUrl(null);
      toast.success("Photo removed.");
      onUpdate?.();
    } catch {
      toast.error("Failed to remove photo");
    }
  };

  return (
    <div className="max-w-2xl space-y-8">
      {/* Avatar */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Profile Photo</h2>
        <div className="flex items-center gap-5">
          {/* Hidden file input */}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={handlePhotoChange}
          />

          {/* Avatar with upload overlay */}
          <div className="relative flex-shrink-0">
            <Avatar src={photoUrl} name={user.name} size="xl" />
            {/* Camera button */}
            <button
              type="button"
              disabled={photoUploading}
              onClick={() => photoInputRef.current?.click()}
              className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              aria-label="Change photo"
            >
              {photoUploading ? (
                <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700">
              {photoUrl ? "Change your profile photo" : "Upload a profile photo"}
            </p>
            <p className="text-xs text-gray-400 mt-1">JPG, PNG, GIF or WebP — max 2MB</p>
            <div className="flex gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                loading={photoUploading}
                onClick={() => photoInputRef.current?.click()}
              >
                {photoUrl ? "Change Photo" : "Choose Photo"}
              </Button>
              {photoUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePhotoRemove}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 flex items-center gap-1"
                >
                  <X className="h-3.5 w-3.5" /> Remove
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Basic Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-5">Basic Information</h2>
        <form onSubmit={handleSubmit(onSaveProfile)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Input
                label="Full Name"
                {...register("name")}
                error={errors.name?.message}
              />
              {nameMismatch && (
                <div className="flex items-start gap-1.5 mt-1.5 p-2 bg-red-50 rounded-lg border border-red-200">
                  <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-600">
                    ⚠️ Your name doesn&apos;t match the name on your resume. This may cause issues during application review.
                  </p>
                </div>
              )}
            </div>
            <Input
              label="Username"
              value={`@${user.username}`}
              disabled
              className="bg-gray-50"
            />
          </div>
          <Input
            label="Email"
            value={user.email}
            disabled
            className="bg-gray-50"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Phone" {...register("phone")} placeholder="+91 9876543210" />
            <Input label="City" {...register("city")} placeholder="Bangalore" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="State" {...register("state")} placeholder="Karnataka" />
            <Input label="Country" {...register("country")} placeholder="India" />
          </div>

          {/* Skills */}
          <TagInput
            label="Skills"
            tags={skills}
            onChange={setSkills}
            placeholder="Add a skill..."
            suggestions={["React", "TypeScript", "Python", "Node.js", "SQL", "Java", "Figma", "Machine Learning"]}
          />

          <Button type="submit" loading={saving} className="w-full sm:w-auto">
            Save Changes
          </Button>
        </form>
      </div>

      {/* Education */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-gray-900">Education</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setEducation([
                ...education,
                { degree: "", field: "", institution: "", startDate: "", endDate: null, grade: null },
              ])
            }
            className="flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
        <div className="space-y-4">
          {education.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              No education added yet. Click <strong>Add</strong> then fill in the fields and hit <strong>Save Education</strong>.
            </p>
          )}
          {education.map((edu, idx) => (
            <EducationEntry
              key={idx}
              edu={edu}
              onChange={(updated) => {
                const copy = [...education];
                copy[idx] = updated;
                setEducation(copy);
              }}
              onRemove={async () => {
                const updated = education.filter((_, i) => i !== idx);
                setEducation(updated);
                try {
                  await saveToMongo({ education: updated });
                  toast.success("Entry removed");
                  onUpdate?.();
                } catch {
                  toast.error("Failed to remove entry");
                }
              }}
            />
          ))}
        </div>
        <Button
          className="mt-4 w-full sm:w-auto"
          loading={savingEdu}
          onClick={async () => {
            setSavingEdu(true);
            try {
              await saveToMongo({ education });
              toast.success("Education saved!");
              onUpdate?.();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed to save education");
            } finally {
              setSavingEdu(false);
            }
          }}
        >
          Save Education
        </Button>
      </div>

      {/* Experience */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-gray-900">Experience</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setExperiences([
                ...experiences,
                { type: "internship", title: "", company: "", startDate: "", endDate: null, current: false, description: null },
              ])
            }
            className="flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
        <div className="space-y-4">
          {experiences.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              No experience added yet. Click <strong>Add</strong> then fill in the fields and hit <strong>Save Experience</strong>.
            </p>
          )}
          {experiences.map((exp, idx) => (
            <ExperienceEntry
              key={idx}
              exp={exp}
              onChange={(updated) => {
                const copy = [...experiences];
                copy[idx] = updated;
                setExperiences(copy);
              }}
              onRemove={async () => {
                const updated = experiences.filter((_, i) => i !== idx);
                setExperiences(updated);
                try {
                  await saveToMongo({ experiences: updated });
                  toast.success("Entry removed");
                  onUpdate?.();
                } catch {
                  toast.error("Failed to remove entry");
                }
              }}
            />
          ))}
        </div>
        <Button
          className="mt-4 w-full sm:w-auto"
          loading={savingExp}
          onClick={async () => {
            setSavingExp(true);
            try {
              await saveToMongo({ experiences });
              toast.success("Experience saved!");
              onUpdate?.();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed to save experience");
            } finally {
              setSavingExp(false);
            }
          }}
        >
          Save Experience
        </Button>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-5">Change Password</h2>
        <form onSubmit={handlePwSubmit(onChangePassword)} className="space-y-4">
          <div className="relative">
            <Input
              label="Current Password"
              type={showCurrentPw ? "text" : "password"}
              {...regPw("currentPassword")}
              error={pwErrors.currentPassword?.message}
              rightIcon={
                <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)}>
                  {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />
          </div>
          <Input
            label="New Password"
            type={showNewPw ? "text" : "password"}
            {...regPw("newPassword")}
            error={pwErrors.newPassword?.message}
            rightIcon={
              <button type="button" onClick={() => setShowNewPw(!showNewPw)}>
                {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />
          <Input
            label="Confirm New Password"
            type="password"
            {...regPw("confirmPassword")}
            error={pwErrors.confirmPassword?.message}
          />
          <Button type="submit" variant="primary" className="w-full sm:w-auto">
            Update Password
          </Button>
        </form>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EducationEntry({
  edu,
  onChange,
  onRemove,
}: {
  edu: Education;
  onChange: (e: Education) => void;
  onRemove: () => void;
}) {
  return (
    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Education Entry</span>
        <button onClick={onRemove} className="text-gray-400 hover:text-red-500 transition-colors">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          placeholder="Degree (e.g. B.Tech)"
          value={edu.degree}
          onChange={(e) => onChange({ ...edu, degree: e.target.value })}
        />
        <Input
          placeholder="Field (e.g. Computer Science)"
          value={edu.field}
          onChange={(e) => onChange({ ...edu, field: e.target.value })}
        />
        <Input
          placeholder="Institution"
          value={edu.institution}
          onChange={(e) => onChange({ ...edu, institution: e.target.value })}
          className="sm:col-span-2"
        />
        <Input
          label="Start Date"
          type="month"
          value={edu.startDate?.slice(0, 7) ?? ""}
          onChange={(e) => onChange({ ...edu, startDate: e.target.value })}
        />
        <Input
          label="End Date"
          type="month"
          value={edu.endDate?.slice(0, 7) ?? ""}
          onChange={(e) => onChange({ ...edu, endDate: e.target.value || null })}
        />
        <Input
          placeholder="Grade / CGPA (optional)"
          value={edu.grade ?? ""}
          onChange={(e) => onChange({ ...edu, grade: e.target.value || null })}
        />
      </div>
    </div>
  );
}

function ExperienceEntry({
  exp,
  onChange,
  onRemove,
}: {
  exp: Experience;
  onChange: (e: Experience) => void;
  onRemove: () => void;
}) {
  return (
    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Experience Entry</span>
        <button onClick={onRemove} className="text-gray-400 hover:text-red-500 transition-colors">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Type</label>
          <select
            value={exp.type}
            onChange={(e) => onChange({ ...exp, type: e.target.value as "job" | "internship" })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="internship">Internship</option>
            <option value="job">Job</option>
          </select>
        </div>
        <Input
          placeholder="Job Title"
          value={exp.title}
          onChange={(e) => onChange({ ...exp, title: e.target.value })}
        />
        <Input
          placeholder="Company"
          value={exp.company}
          onChange={(e) => onChange({ ...exp, company: e.target.value })}
          className="sm:col-span-2"
        />
        <Input
          label="Start Date"
          type="month"
          value={exp.startDate?.slice(0, 7) ?? ""}
          onChange={(e) => onChange({ ...exp, startDate: e.target.value })}
        />
        <div>
          <Input
            label="End Date"
            type="month"
            value={exp.endDate?.slice(0, 7) ?? ""}
            onChange={(e) => onChange({ ...exp, endDate: e.target.value || null })}
            disabled={exp.current}
          />
          <label className="flex items-center gap-2 mt-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={exp.current}
              onChange={(e) => onChange({ ...exp, current: e.target.checked, endDate: null })}
              className="accent-blue-600"
            />
            <span className="text-xs text-gray-600">Currently working here</span>
          </label>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-gray-600 mb-1 block">Description (optional)</label>
          <textarea
            value={exp.description ?? ""}
            onChange={(e) => onChange({ ...exp, description: e.target.value || null })}
            rows={2}
            placeholder="Brief description of your role..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
      </div>
    </div>
  );
}
