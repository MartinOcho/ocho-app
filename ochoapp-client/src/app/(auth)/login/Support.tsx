"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import GoogleSignInButton from "./GoogleSignInButton";
import GithubSignInButton from "./GithubSignInButton";
import { useTranslation } from "@/context/LanguageContext";

export default function Support() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const searchParams = useSearchParams();
  const [isSameOrigin, setIsSameOrigin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useTranslation();

  const isSwitching =
    searchParams.get("switching") === "true" ||
    searchParams.get("switching") === "1";
  const switchingParam = isSwitching ? "?switching=true" : "";

  useEffect(() => {
    setIsLoading(false);
    if (baseUrl) {
      const currentUrl = window.location.origin;
      setIsSameOrigin(currentUrl === baseUrl);
    }
  }, [baseUrl]);

  return (
    <div className="flex w-full flex-col">
      <div className="flex w-full justify-center gap-2">
        <GoogleSignInButton
          supported={isSameOrigin && !isLoading}
          switchingParam={switchingParam}
        />
        <GithubSignInButton
          supported={isSameOrigin && !isLoading}
          switchingParam={switchingParam}
        />
      </div>
      {!isLoading && !isSameOrigin && (
        <span className="text-center text-sm italic text-destructive">
          {t("unsupportedEnv")}
        </span>
      )}
    </div>
  );
}

