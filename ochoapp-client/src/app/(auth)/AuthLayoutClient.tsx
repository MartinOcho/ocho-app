"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface AuthLayoutClientProps {
  user: any;
  children: React.ReactNode;
}

export default function AuthLayoutClient({
  user,
  children,
}: AuthLayoutClientProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const isSwitching = searchParams.get("switching") === "true";
  const isLogoutAccountsPage = pathname?.includes("/logout-accounts");

  useEffect(() => {
    if (user && !isSwitching && !isRedirecting && !isLogoutAccountsPage) {
      setIsRedirecting(true);
      // Utiliser replace plutôt que push pour éviter une entrée d'historique
      router.replace("/");
    }
  }, [user, isSwitching, router, isRedirecting, isLogoutAccountsPage]);

  return (
    <main className="flex h-screen max-h-vh items-center justify-center p-5">
      <div className="flex flex-col items-center justify-between gap-5 h-full">
        {children}
        <div className="privacy text-muted-foreground text-center px-1 text-sm">
          <p>
            En utilisant OchoApp, vous acceptez les présentes{" "}
            <a
              href="/terms-of-use"
              className="text-primary hover:underline max-sm:underline"
            >
              Conditions d&apos;Utilisation
            </a>{" "}
            et avez lu la{" "}
            <a
              href="/privacy"
              className="text-primary hover:underline max-sm:underline"
            >
              politique de confidentialité
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
