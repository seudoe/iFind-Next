import Link from "next/link";
import { MapPin, Wifi } from "lucide-react";

interface Location {
    name: string;
    count: number;
}

interface LocationsSectionProps {
    locations: Location[];
}

export function LocationsSection({ locations }: LocationsSectionProps) {
    // Show at least 10 locations, use fallback if needed
    const displayLocations =
        locations.length > 0
            ? locations
            : [
                  { name: "Work from Home", count: 0 },
                  { name: "Bangalore", count: 0 },
                  { name: "Delhi", count: 0 },
                  { name: "Hyderabad", count: 0 },
                  { name: "Mumbai", count: 0 },
                  { name: "Chennai", count: 0 },
                  { name: "Pune", count: 0 },
                  { name: "Kolkata", count: 0 },
                  { name: "Jaipur", count: 0 },
                  { name: "International", count: 0 },
              ];

    return (
        <section className="py-16 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-10">
                    <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                        Internships by Location
                    </h2>
                    <p className="text-gray-500 mt-2">
                        Find opportunities near you or work remotely
                    </p>
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                    {displayLocations.map((loc) => (
                        <Link
                            key={loc.name}
                            href={`/dashboard?tab=internships&location=${encodeURIComponent(loc.name)}`}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition-all text-sm font-medium text-gray-700 shadow-sm"
                        >
                            {loc.name === "Work from Home" ? (
                                <Wifi className="h-4 w-4 text-green-500" />
                            ) : (
                                <MapPin className="h-4 w-4 text-blue-500" />
                            )}
                            <span>{loc.name}</span>
                            {loc.count > 0 && (
                                <span className="text-xs text-gray-400">
                                    ({loc.count})
                                </span>
                            )}
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
}
