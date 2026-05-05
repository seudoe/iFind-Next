"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, Camera, Eye, EyeOff, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import { toast } from "sonner";
import type { User } from "@/types";

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
  const [saving, setSaving] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const [photoUrl, setPhotoUrl] = useState<string | null>(user.profilePicture ?? null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

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

  // Name mismatch warning — compare with resume metaDetails name if available
  const resumeName = user.resume?.parsedData?.metaDetails?.name ?? null;
  const nameMismatch =
    resumeName &&
    watchedName &&
    resumeName.toLowerCase().trim() !== watchedName.toLowerCase().trim();

  const onSaveProfile = async (data: ProfileForm) => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
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
    if (!allowed.includes(file.type)) { toast.error("Only JPG, PNG, GIF, or WebP images are accepted."); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Image must be under 2MB."); return; }

    setPhotoUploading(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch("/api/user/photo", { method: "POST", body: formData, credentials: "include" });
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
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={handlePhotoChange}
          />
          <div className="relative flex-shrink-0">
            <Avatar src={photoUrl} name={user.name} size="xl" />
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
              <Button variant="outline" size="sm" loading={photoUploading} onClick={() => photoInputRef.current?.click()}>
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
              <Input label="Full Name" {...register("name")} error={errors.name?.message} />
              {nameMismatch && (
                <div className="flex items-start gap-1.5 mt-1.5 p-2 bg-amber-50 rounded-lg border border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    Your name doesn&apos;t match the name on your resume ({resumeName}). This may cause issues during application review.
                  </p>
                </div>
              )}
            </div>
            <Input label="Username" value={`@${user.username}`} disabled className="bg-gray-50" />
          </div>
          <Input label="Email" value={user.email} disabled className="bg-gray-50" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Phone" {...register("phone")} placeholder="+91 9876543210" />
            <Input label="City" {...register("city")} placeholder="Bangalore" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="State" {...register("state")} placeholder="Karnataka" />
            <Input label="Country" {...register("country")} placeholder="India" />
          </div>
          <p className="text-xs text-gray-400">
            Skills, education, and work history are managed through your resume. Upload a resume in the Resume tab to update them.
          </p>
          <Button type="submit" loading={saving} className="w-full sm:w-auto">
            Save Changes
          </Button>
        </form>
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
