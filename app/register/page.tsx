"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Briefcase, ArrowRight, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TagInput } from "@/components/ui/TagInput";
import { toast } from "sonner";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be under 20 characters")
    .regex(/^[a-z0-9_]+$/, "Only lowercase letters, numbers, and underscores"),
  email: z.string().email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[0-9]/, "Must contain at least one number"),
  city: z.string().optional(),
});

type RegisterForm = z.infer<typeof registerSchema>;

const SKILL_SUGGESTIONS = [
  "React", "TypeScript", "Python", "Node.js", "Java", "SQL",
  "Machine Learning", "Figma", "Marketing", "Excel", "C++", "Flutter",
];

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const password = watch("password", "");
  const passwordChecks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
  };

  const onSubmit = async (data: RegisterForm) => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, skills }),
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Registration failed");
      toast.success("Account created! Welcome to iFind 🎉");
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <Briefcase className="h-5 w-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-blue-600">iFind</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-5">Create your account</h1>
          <p className="text-gray-500 text-sm mt-1">Join 2M+ students finding internships</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Full Name"
              placeholder="Rahul Sharma"
              {...register("name")}
              error={errors.name?.message}
              autoComplete="name"
            />

            <Input
              label="Username"
              placeholder="rahulsharma"
              {...register("username")}
              error={errors.username?.message}
              autoComplete="username"
            />

            <Input
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              {...register("email")}
              error={errors.email?.message}
              autoComplete="email"
            />

            <div>
              <Input
                label="Password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a strong password"
                {...register("password")}
                error={errors.password?.message}
                autoComplete="new-password"
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />
              {/* Password strength */}
              {password && (
                <div className="mt-2 space-y-1">
                  {Object.entries(passwordChecks).map(([key, ok]) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <CheckCircle className={`h-3.5 w-3.5 ${ok ? "text-green-500" : "text-gray-300"}`} />
                      <span className={`text-xs ${ok ? "text-green-600" : "text-gray-400"}`}>
                        {key === "length" ? "At least 8 characters" : key === "uppercase" ? "One uppercase letter" : "One number"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Input
              label="City (optional)"
              placeholder="Bangalore"
              {...register("city")}
            />

            <TagInput
              label="Skills (optional)"
              tags={skills}
              onChange={setSkills}
              placeholder="Add your skills..."
              suggestions={SKILL_SUGGESTIONS}
            />

            <Button
              type="submit"
              loading={isSubmitting}
              className="w-full flex items-center justify-center gap-2 mt-2"
              size="lg"
            >
              Create Account <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <p className="text-xs text-gray-400 text-center mt-4">
            By registering, you agree to our{" "}
            <Link href="#" className="text-blue-600 hover:underline">Terms of Service</Link>{" "}
            and{" "}
            <Link href="#" className="text-blue-600 hover:underline">Privacy Policy</Link>.
          </p>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-600 font-medium hover:text-blue-800">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
