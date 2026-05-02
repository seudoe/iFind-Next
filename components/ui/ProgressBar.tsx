import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number; // 0-100
  className?: string;
  showLabel?: boolean;
  color?: "blue" | "green" | "yellow" | "red";
}

const colorClasses = {
  blue: "bg-blue-600",
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  red: "bg-red-500",
};

export function ProgressBar({
  value,
  className,
  showLabel = false,
  color = "blue",
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", colorClasses[color])}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-sm font-medium text-gray-700 w-10 text-right">
          {clamped}%
        </span>
      )}
    </div>
  );
}
