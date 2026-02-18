interface BrowserLogoProps {
  className?: string;
  size?: number;
}

export function FirefoxLogo({ className, size = 48 }: BrowserLogoProps) {
  return <img src="/logos/firefox-logo.svg" alt="Firefox" className={className} width={size} height={size} />;
}

export function SafariLogo({ className, size = 48 }: BrowserLogoProps) {
  return <img src="/logos/safari-logo.svg" alt="Safari" className={className} width={size} height={size} />;
}

export function EdgeLogo({ className, size = 48 }: BrowserLogoProps) {
  return <img src="/logos/edge-logo.svg" alt="Edge" className={className} width={size} height={size} />;
}

export function OperaLogo({ className, size = 48 }: BrowserLogoProps) {
  return <img src="/logos/opera-logo.svg" alt="Opera" className={className} width={size} height={size} />;
}

export function BraveLogo({ className, size = 48 }: BrowserLogoProps) {
  return <img src="/logos/brave-logo.svg" alt="Brave" className={className} width={size} height={size} />;
}
