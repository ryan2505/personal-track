import { cn } from "@/lib/utils";

/** Barre de progression. Le ratio est calculé par le domaine, jamais ici. */
export function ProgressBar({
  ratio,
  className,
  tone = "accent",
}: {
  ratio: number | null;
  className?: string;
  tone?: "accent" | "success";
}) {
  const width = ratio === null ? 0 : Math.round(ratio * 100);
  return (
    <div className={cn("bg-surface-2 h-1.5 w-full overflow-hidden rounded-full", className)}>
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-240",
          tone === "success" ? "bg-success" : "bg-accent",
        )}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

/** Anneau de score. Rendu en SVG pur : pas de librairie de charts pour ça. */
export function ScoreRing({
  ratio,
  size = 76,
  label,
}: {
  ratio: number | null;
  size?: number;
  label: string;
}) {
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - (ratio ?? 0));

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-surface-2"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="stroke-accent transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="tabular absolute text-lg font-medium">{label}</span>
    </div>
  );
}
