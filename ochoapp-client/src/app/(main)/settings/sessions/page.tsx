import SetNavigation from "@/components/SetNavigation";
import TrendsSidebar from "@/components/TrendsSidebar";
import { getTranslation } from "@/lib/language";
import ActiveSessions from "@/components/settings/ActiveSessions";
import { Shield } from "lucide-react";

export default async function ActiveSessionsPage() {
  const { settings } = await getTranslation();
  
  return (
    <>
      <SetNavigation navPage="settings" />
      <div className="w-full min-w-0 max-w-lg space-y-2 sm:space-y-5 max-sm:pb-16">
        <div className="bg-card/50 p-5 shadow-sm sm:rounded-2xl sm:bg-card">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-6 h-6" />
            <h2 className="text-2xl font-bold">Appareils et sessions</h2>
          </div>
          <p className="text-sm text-gray-600">
            Gérez vos sessions actives sur tous vos appareils
          </p>
        </div>

        <div className="bg-card/50 p-5 shadow-sm sm:rounded-2xl sm:bg-card">
          <ActiveSessions />
        </div>
      </div>
      <TrendsSidebar />
    </>
  );
}
