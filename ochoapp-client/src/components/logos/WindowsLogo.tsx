interface WindowsLogoProps {
  className?: string;
  size?: number;
}

export function WindowsLogo({ className, size = 48 }: WindowsLogoProps) {
  return (
    <svg viewBox="0 0 4875 4875" className={className} width={size} height={size}>
      <path
        fill="#0078d4"
        d="M0 0h2311v2310H0zm2564 0h2311v2310H2564zM0 2564h2311v2311H0zm2564 0h2311v2311H2564"
      />
    </svg>
  );
}
