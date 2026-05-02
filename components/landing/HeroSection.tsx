"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

const POPULAR_SEARCHES = ["React Developer", "Data Science", "UI/UX Design", "Marketing", "Finance"];

export function HeroSection() {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (role) params.set("q", role);
    if (location) params.set("location", location);
    router.push(`/dashboard?tab=internships&${params.toString()}`);
  };

  return (
    <section className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-white/5" />
        <div className="absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-white/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-white/3" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
        <div className="text-center max-w-3xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm mb-6 border border-white/20">
            <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            <span>10,000+ new internships this week</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-5">
            Find Internships That{" "}
            <span className="text-yellow-300">Match Your Skills</span>
          </h1>
          <p className="text-lg sm:text-xl text-blue-100 mb-10 max-w-2xl mx-auto leading-relaxed">
            India&apos;s smartest internship platform. AI-powered matching connects you with
            opportunities at top companies — tailored to your profile.
          </p>

          {/* Search Bar */}
          <div className="bg-white rounded-2xl p-2 shadow-2xl flex flex-col sm:flex-row gap-2 max-w-2xl mx-auto">
            <div className="flex items-center gap-2 flex-1 px-3">
              <Search className="h-5 w-5 text-gray-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Role, skill, or company..."
                value={role}
                onChange={(e) => setRole(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1 text-gray-900 placeholder:text-gray-400 text-sm outline-none py-2"
              />
            </div>
            <div className="hidden sm:block w-px bg-gray-200 self-stretch" />
            <div className="flex items-center gap-2 flex-1 px-3">
              <MapPin className="h-5 w-5 text-gray-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Location or Work from Home"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1 text-gray-900 placeholder:text-gray-400 text-sm outline-none py-2"
              />
            </div>
            <Button
              onClick={handleSearch}
              size="lg"
              className="rounded-xl flex items-center gap-2 flex-shrink-0"
            >
              Search <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Popular Searches */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
            <span className="text-sm text-blue-200">Popular:</span>
            {POPULAR_SEARCHES.map((term) => (
              <button
                key={term}
                onClick={() => { setRole(term); handleSearch(); }}
                className="text-sm bg-white/10 hover:bg-white/20 border border-white/20 rounded-full px-3 py-1 transition-colors"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
