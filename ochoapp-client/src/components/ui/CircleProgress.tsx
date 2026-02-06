"use client";

import { cn } from "@/lib/utils";

interface CircleProgressProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function CircleProgress({
  progress,
  size = 40,
  strokeWidth = 3,
  className,
}: CircleProgressProps) {
  const circumference = 2 * Math.PI * (size / 2 - strokeWidth);
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg
      width={size}
      height={size}
      className={cn("transform -rotate-90", className)}
      viewBox={`0 0 ${size} ${size}`}
    >
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={size / 2 - strokeWidth}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        opacity={0.2}
      />
      {/* Progress circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={size / 2 - strokeWidth}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-300"
      />
      {/* Percentage text */}
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dy="0.3em"
        className="text-xs font-semibold fill-current transform rotate-90"
        fontSize={size * 0.3}
      >
        {Math.round(progress)}%
      </text>
    </svg>
  );
}
