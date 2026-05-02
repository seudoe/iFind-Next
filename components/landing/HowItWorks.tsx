import { UserPlus, Search, Send } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

const STEPS = [
  {
    step: "01",
    icon: UserPlus,
    title: "Create Your Profile",
    description:
      "Sign up and build your profile with your skills, education, and experience. Upload your resume to unlock AI-powered matching.",
    color: "bg-blue-100 text-blue-600",
  },
  {
    step: "02",
    icon: Search,
    title: "Discover Opportunities",
    description:
      "Browse thousands of internships filtered by your preferences. Our AI recommends the best matches based on your profile.",
    color: "bg-purple-100 text-purple-600",
  },
  {
    step: "03",
    icon: Send,
    title: "Apply & Get Hired",
    description:
      "Apply with one click, track your applications, and land your dream internship. Get notified on every status update.",
    color: "bg-green-100 text-green-600",
  },
];

export function HowItWorks() {
  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">How iFind Works</h2>
          <p className="text-gray-500 mt-2">Get started in 3 simple steps</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connector line */}
          <div className="hidden md:block absolute top-12 left-1/3 right-1/3 h-0.5 bg-gradient-to-r from-blue-200 via-purple-200 to-green-200" />

          {STEPS.map(({ step, icon: Icon, title, description, color }) => (
            <div key={step} className="relative text-center">
              <div className="flex justify-center mb-5">
                <div className={`h-20 w-20 rounded-2xl ${color} flex items-center justify-center shadow-sm relative`}>
                  <Icon className="h-9 w-9" />
                  <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center">
                    {step}
                  </span>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">{description}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link href="/register">
            <Button size="lg" className="px-8">
              Get Started Free
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
