interface WindowsLogoProps {
  className?: string;
  size?: number;
}

export function WindowsLogo({ className = "w-6 h-6", size }: WindowsLogoProps) {
  return (
    <svg viewBox="0 0 4875 4875" className={className} width={size} height={size} xmlns="http://www.w3.org/2000/svg">
      <path
        fill="#0078d4"
        d="M0 0h2311v2310H0zm2564 0h2311v2310H2564zM0 2564h2311v2311H0zm2564 0h2311v2311H2564"
      />
    </svg>
  );
}
