import Link from "next/link";

interface Category {
    label: string;
    icon: string;
    count: number;
}

interface CategoriesSectionProps {
    categories: Category[];
}

export function CategoriesSection({ categories }: CategoriesSectionProps) {
    // Show at least 8 categories, use fallback if needed
    const displayCategories =
        categories.length > 0
            ? categories
            : [
                  { label: "Technology", icon: "💻", count: 0 },
                  { label: "Marketing", icon: "📣", count: 0 },
                  { label: "Design", icon: "🎨", count: 0 },
                  { label: "Finance", icon: "💰", count: 0 },
                  { label: "Data Science", icon: "📊", count: 0 },
                  { label: "Content Writing", icon: "✍️", count: 0 },
                  { label: "HR & Management", icon: "👥", count: 0 },
                  { label: "Operations", icon: "⚙️", count: 0 },
              ];

    return (
        <section className="py-16 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-10">
                    <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                        Browse by Category
                    </h2>
                    <p className="text-gray-500 mt-2">
                        Explore internships across popular domains
                    </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {displayCategories.map(({ label, icon, count }) => (
                        <Link
                            key={label}
                            href={`/dashboard?tab=internships&category=${encodeURIComponent(label)}`}
                            className="group bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-md transition-all text-center"
                        >
                            <div className="text-3xl mb-3">{icon}</div>
                            <h3 className="font-semibold text-gray-900 text-sm group-hover:text-blue-600 transition-colors">
                                {label}
                            </h3>
                            <p className="text-xs text-gray-400 mt-1">
                                {count.toLocaleString()} internships
                            </p>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
}
