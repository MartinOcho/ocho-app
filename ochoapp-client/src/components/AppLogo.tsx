import { cn } from "@/lib/utils";

interface AppLogoProps {
  className?: string;
  size?: number;
  logo?: "TEXT" | "LOGO";
}
export const isXmas = (): boolean => {
  const today = new Date();
  const start = new Date(today.getFullYear(), 11, 24); // 24 décembre
  const end = new Date(today.getFullYear() + 1, 0, 2, 23, 59, 59); // 2 janvier inclus

  return today >= start && today <= end;
};
export default function AppLogo({
  className = "",
  size = 48,
  logo,
}: AppLogoProps) {
  const logoEl = isXmas() ? (
    <LogoXmas className={className} size={size} />
  ) : (
    <Logo className={className} size={size} />
  );

  const textGradientClasses = "bg-gradient-to-r from-[#157ff2] to-[#0c50cc] text-transparent bg-clip-text";
  const textSizeClass = `text-[${size}px]`;
  const stackedTextSizeClass = `text-[${size > 48 ? size * 1.25 : size}px]`;

  if (logo) {
    if (logo === "TEXT") {
      return (
        <span className={cn(textSizeClass, "font-bold", textGradientClasses, className)}>
          OchoApp
        </span>
      );
    }
    if (logo === "LOGO") {
      return logoEl;
    }
  }

  return (
    <span className={className}>
      <div
        className={cn(`flex select-none items-center`, size > 80 && `flex-col`)}
      >
        {logoEl}
        <span
          className={cn(stackedTextSizeClass, "font-bold", textGradientClasses)}
        >
          OchoApp
        </span>
      </div>
    </span>
  );
}

export function Logo({ className = "", size = 48 }: AppLogoProps) {
  const iconSize = size / 1.5;
  return (
    <svg
      width={iconSize / 2}
      height={iconSize}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      aria-label="OchoApp logo"
    >
      <defs>
        <linearGradient
          id="logoGradient"
          x1="50"
          y1="0"
          x2="50"
          y2="100"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#157ff2" />
          <stop offset="1" stopColor="#0c50cc" />
        </linearGradient>
      </defs>
      <path
        d="M50,50 C30,30 20,10 50,10 C80,10 70,30 50,50 C30,70 20,90 50,90 C80,90 70,70 50,50 Z"
        fill="none"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="translate(0,2)"
      />
      <path
        d="M50,50 C30,30 20,10 50,10 C80,10 70,30 50,50 C30,70 20,90 50,90 C80,90 70,70 50,50 Z"
        fill="none"
        stroke="url(#logoGradient)"
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function LogoXmas({ className = "", size = 48 }: AppLogoProps) {
  const iconSize = size / 1.5;
  return (
    <svg
      width={iconSize / 2}
      height={iconSize}
      viewBox="0 0 14 24"
      fill="none"
      className={className}
      aria-label="OchoApp logo Noël"
    >
      <defs>
        <linearGradient
          id="xmasGradient"
          x1="50"
          y1="28"
          x2="50"
          y2="36.52"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#157ff2" />
          <stop offset="1" stopColor="#0c50cc" />
        </linearGradient>
      </defs>
      <path
        fill="none"
        stroke="url(#xmasGradient)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeMiterlimit="1.4"
        d="
	M6.3,11.3c-3.1-3.1-4.6-6.2,0-6.2S9.4,8.2,6.3,11.3s-4.6,6.2,0,6.2S9.4,14.4,6.3,11.3z"
      />
      <path
        fill="#FF0000"
        d="M5.6,3.1c0,0,3.8-3,5.4-2c0.9,0.5,0.7,1.5,1.6,5.3c0.2,0.8-1.3-0.9-1.5-1.5c0,0-0.1,1.9-0.4,2
	C10.1,7.1,5,3.7,5.6,3.1z"
      />
      <path
        fill="#FFFFFF"
        stroke="#00000011"
        strokeWidth={1}
        d="M10.8,7.6c0-0.1,0.1-0.2-0.1-0.7c-0.2-0.3-0.4-0.6-0.6-0.7c-0.1-0.1,0.4,0.1,0.3,0.1
	C9.8,5.5,8.9,5.1,8.9,5.1l0.4,0C8.8,4.6,7.8,4.1,7.4,3.9l0.4,0c-0.6-0.4-1.5-0.7-2-0.7c-0.1,0,0.1-0.1,0.1-0.1L5.5,3
	C5.1,3,4.9,3,4.8,3.4L4.5,4.1c-0.1,0.2,0,0.5,0.4,0.5c0,0,0.7,0.2,2.6,1.4C9.3,7.2,9.7,8,9.7,8c0.2,0.3,0.5,0.2,0.7-0.1"
      />
    </svg>
  );
}
