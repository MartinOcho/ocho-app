"use client";

import { Shield } from "lucide-react";
import { useTranslation } from "@/context/LanguageContext";

export default function SessionsHeader() {
  const { t } = useTranslation();

  return (
    <div className="bg-card/50 p-5 shadow-sm sm:rounded-2xl sm:bg-card">
      <div className="flex items-center gap-3 mb-2">
        <Shield className="w-6 h-6" />
        <h2 className="text-2xl font-bold">{t("devicesAndSessions")}</h2>
      </div>
      <p className="text-sm text-gray-600">
        {t("manageActiveSessions")}
      </p>
    </div>
  );
}
