import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { HeroSection } from "@/components/landing/HeroSection";
import { StatsBar } from "@/components/landing/StatsBar";
import { CategoriesSection } from "@/components/landing/CategoriesSection";
import { LocationsSection } from "@/components/landing/LocationsSection";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Testimonials } from "@/components/landing/Testimonials";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <StatsBar />
        <CategoriesSection />
        <LocationsSection />
        <HowItWorks />
        <Testimonials />
      </main>
      <Footer />
    </div>
  );
}
