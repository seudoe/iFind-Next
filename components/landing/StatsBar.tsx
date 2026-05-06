interface StatsBarProps {
    stats: {
        totalInternships: number;
        totalUsers: number;
        totalCompanies: number;
        placementRate: number;
    };
}

function formatNumber(num: number): string {
    if (num >= 1000000) {
        return `${(num / 1000000).toFixed(1)}M+`;
    } else if (num >= 1000) {
        return `${(num / 1000).toFixed(1)}K+`;
    }
    return num.toString();
}

export function StatsBar({ stats }: StatsBarProps) {
    const STATS = [
        {
            value: formatNumber(stats.totalInternships),
            label: "Active Internships",
        },
        { value: formatNumber(stats.totalUsers), label: "Students Registered" },
        {
            value: formatNumber(stats.totalCompanies),
            label: "Partner Companies",
        },
        { value: `${stats.placementRate}%`, label: "Placement Rate" },
    ];

    return (
        <section className="bg-white border-b border-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-0 lg:divide-x lg:divide-gray-200">
                    {STATS.map(({ value, label }) => (
                        <div key={label} className="text-center px-4">
                            <p className="text-2xl sm:text-3xl font-bold text-blue-600">
                                {value}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                                {label}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
