import { cn } from "@/lib/utils";

interface WindowsLogoProps {
  className?: string;
  size?: number;
}

export function WindowsLogo({ className = "w-6 h-6", size }: WindowsLogoProps) {
  return (
    <svg viewBox="0 0 4875 4875" className={cn("text-[#0078d4]", className)} width={size} height={size} >
      <path
        fill="currentColor"
        d="M0 0h2311v2310H0zm2564 0h2311v2310H2564zM0 2564h2311v2311H0zm2564 0h2311v2311H2564"
      />
    </svg>
  );
}
