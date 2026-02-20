"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import type { User } from "lucia";
import { useTranslation } from "@/context/LanguageContext";
import { Language } from "@/lib/vocabulary";
import { Check } from "lucide-react";
import French from "@/components/flags/French";
import US from "@/components/flags/US";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AuthLayoutClientProps {
  user: User | null;
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
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation();

  const isSwitching = searchParams.get("switching") === "true";
  const isLogoutAccountsPage = pathname?.includes("/logout-accounts");
  const isLegalPage =
    pathname?.includes("/terms-of-use") || pathname?.includes("/privacy");

  useEffect(() => {
    if (
      user &&
      !isSwitching &&
      !isRedirecting &&
      !isLogoutAccountsPage &&
      !isLegalPage
    ) {
      setIsRedirecting(true);
      // Utiliser replace plutôt que push pour éviter une entrée d'historique
      router.replace("/");
    }
  }, [
    user,
    isSwitching,
    router,
    isRedirecting,
    isLogoutAccountsPage,
    isLegalPage,
  ]);

  return (
    <>
      <div className="fixed right-4 top-4 z-50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg border bg-card/30 px-3 py-2 shadow-lg backdrop-blur-md transition-all duration-300 hover:bg-card/50">
              {language === "fr" && <French className="h-4 w-4" />}
              {language === "en" && <US className="h-4 w-4" />}
              <span className="text-sm font-medium">
                {language.toUpperCase()}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setLanguage("fr" as Language);
              }}
            >
              <French className="mr-2 h-4 w-4" />
              Français
              {language === "fr" && <Check className="ms-2 h-4 w-4" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setLanguage("en" as Language);
              }}
            >
              <US className="mr-2 h-4 w-4" />
              English
              {language === "en" && <Check className="ms-2 h-4 w-4" />}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <main className="max-h-vh flex h-screen items-center justify-center p-5">
        <div className="flex h-full flex-col items-center justify-between gap-5">
          {children}
          <footer className="privacy px-1 text-center text-sm text-muted-foreground">
            <p>
              {t("privacyDisclaimer").split("[terms]")[0]}{" "}
              <a
                href="/terms-of-use"
                className="text-primary hover:underline max-sm:underline"
              >
                {t("termsOfUse")}
              </a>{" "}
              {t("privacyDisclaimer").split("[terms]")[1].split("[privacy]")[0]}{" "}
              <a
                href="/privacy"
                className="text-primary hover:underline max-sm:underline"
              >
                {t("privacyPolicy")}
              </a>
              .
            </p>
          </footer>
        </div>
      </main>
    </>
  );
}
