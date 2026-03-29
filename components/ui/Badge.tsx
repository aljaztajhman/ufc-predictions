import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "red" | "gold" | "green" | "gray" | "outline";
  size?: "sm" | "md";
  className?: string;
  pulse?: boolean;
}

export function Badge({ children, variant = "gray", size = "sm", className, pulse }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider rounded-full",
        size === "sm" ? "text-xs px-2 py-0.5" : "text-xs px-3 py-1",
        variant === "red" && "bg-ufc-red/15 text-ufc-red border border-ufc-red/30",
        variant === "gold" && "bg-amber-500/15 text-amber-400 border border-amber-500/30",
        variant === "green" && "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
        variant === "gray" && "bg-white/8 text-white/60 border border-white/10",
        variant === "outline" && "bg-transparent text-white/70 border border-white/20",
        className
      )}
    >
      {pulse && (
        <span className={cn(
          "w-1.5 h-1.5 rounded-full",
          variant === "red" ? "bg-ufc-red animate-pulse" : "bg-current animate-pulse"
        )} />
      )}
      {children}
    </span>
  );
}

export function TitleFightBadge() {
  return (
    <Badge variant="gold" size="md">
      <span>🏆</span> Title Fight
    </Badge>
  );
}

export function EventTimeBadge({ label }: { label: "TONIGHT" | "TOMORROW" | "LIVE" }) {
  if (label === "LIVE") {
    return <Badge variant="red" pulse>LIVE NOW</Badge>;
  }
  return (
    <Badge variant={label === "TONIGHT" ? "red" : "gold"} pulse={label === "TONIGHT"}>
      {label}
    </Badge>
  );
}
