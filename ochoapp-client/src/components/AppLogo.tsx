interface AppLogoProps {
  className?: string;
  size?: number;
  logo?: "TEXT" | "LOGO";
}

export default function AppLogo({
  className = "",
  size = 48,
  logo,
}: AppLogoProps) {

  const shouldShowLogo = (): boolean => {
    const today = new Date();
    const start = new Date(today.getFullYear(), 11, 24); // 24 décembre
    const end = new Date(today.getFullYear() + 1, 0, 2, 23, 59, 59); // 2 janvier inclus

    return today >= start && today <= end;
  };

  const logoEl = shouldShowLogo() ? (
    <LogoXmas className={className} size={size} />
  ) : (
    <Logo className={className} size={size} />
  );

  if (logo) {
    if (logo === "TEXT") {
      return (
        <span className={`text-[${size}px] font-bold ${className}`}>
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
        className={`flex select-none items-center ${size <= 80 ? `h-[${size}px]` : `w-[${size}px] flex-col`} gap-1 text-primary`}
      >
        {logoEl}
        <span
          className={`text-[${size > 48 ? size * 1.25 : size}px] font-bold`}
        >
          OchoApp
        </span>
      </div>
    </span>
  );
}

function Logo({ className = "", size = 48 }: AppLogoProps) {
  const iconSize = size/2;
  return (
    <svg
      width={iconSize/2}
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
      <g transform="translate(28 28) scale(0.44)">
        <path
          d="M50,50 C30,30 20,10 50,10 C80,10 70,30 50,50 C30,70 20,90 50,90 C80,90 70,70 50,50 Z"
          fill="none"
          stroke="rgba(0,0,0,0.1)"
          strokeWidth="14"
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
      </g>
    </svg>
  );
}
function LogoXmas({ className = "", size = 48 }: AppLogoProps) {
  const iconSize = size/2;
  return (
    <svg
      width={iconSize/2}
      height={iconSize}
      viewBox="0 0 100 100"
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
        d="M50,50c-8.8,-8.8 -13.2,-17.6 0,-17.6S58.8,41.2 50,50s-13.2,17.6 0,17.6S58.8,58.8 50,50z"
        fill="none"
        stroke="url(#xmasGradient)"
        strokeWidth="5.72"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M48,26.7c0,0 10.8,-8.6 15.5,-5.6c2.5,1.5 2.1,4.2 4.5,15.1c0.5,2.2 -3.6,-2.7 -4.4,-4.2c0,0 -0.3,5.5 -1.2,5.8C60.8,38.1 46.3,28.3 48,26.7z"
        fill="#FF0000"
      />
      <path
        d="M62.8,39.3c0.1,-0.4 0.2,-0.7 -0.2,-2c-0.6,-1 -1.2,-1.6 -1.7,-2c-0.2,-0.2 1,0.3 0.8,0.2c-1.9,-2.1 -4.4,-3.2 -4.4,-3.2l1.1,-0.1c-1.3,-1.2 -4.1,-2.7 -5.5,-3.2l1.2,-0.1c-1.8,-1.2 -4.2,-2 -5.7,-2.1c-0.2,0 0.2,-0.3 0.2,-0.3l-1,-0.2c-1.1,-0.1 -1.7,0.1 -2.1,1.2l-0.8,1.8c-0.3,0.5 0.1,1.4 1.1,1.4c0,0 2.1,0.6 7.5,4.1c5.2,3.4 6.3,5.9 6.3,5.9c0.7,1 1.4,0.7 2.1,-0.2"
        fill="#FFFFFF"
      />
    </svg>
  );
}			