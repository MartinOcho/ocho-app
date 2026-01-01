interface FrenchProps {
  className?: string;
  size?: number;
}

export default function French({ className, size = 24 }: FrenchProps) {
 return <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    width={size}
    height={size}
    viewBox="0 0 36 36"
  >
    <path fill="#ED2939" d="M36 27a4 4 0 0 1-4 4h-8V5h8a4 4 0 0 1 4 4v18z" />
    <path fill="#EEE" d="M12 5h12v26H12z" />
    <path fill="#002495" d="M4 5a4 4 0 0 0-4 4v18a4 4 0 0 0 4 4h8V5H4z" />
  </svg>;
}
