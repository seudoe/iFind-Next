import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { HeroSection } from "@/components/landing/HeroSection";
import { StatsBar } from "@/components/landing/StatsBar";
import { CategoriesSection } from "@/components/landing/CategoriesSection";
import { LocationsSection } from "@/components/landing/LocationsSection";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Testimonials } from "@/components/landing/Testimonials";

async function getStats() {
    try {
        const baseUrl =
            process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
        const res = await fetch(`${baseUrl}/api/stats`, {
            cache: "no-store", // Always fetch fresh data
        });

        if (!res.ok) {
            throw new Error("Failed to fetch stats");
        }

        return res.json();
    } catch (error) {
        console.error("Error fetching stats:", error);
        // Return fallback data
        return {
            stats: {
                totalInternships: 0,
                totalUsers: 0,
                totalCompanies: 0,
                placementRate: 95,
            },
            categories: [],
            locations: [],
        };
    }
}

export default async function LandingPage() {
    const data = await getStats();

    return (
        <div className="flex flex-col min-h-screen">
            <Navbar />
            <main className="flex-1">
                <HeroSection />
                <StatsBar stats={data.stats} />
                <CategoriesSection categories={data.categories} />
                <LocationsSection locations={data.locations} />
                <HowItWorks />
                <Testimonials />
            </main>
            <Footer />
        </div>
    );
}
