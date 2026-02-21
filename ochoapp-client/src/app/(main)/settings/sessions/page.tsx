import SetNavigation from "@/components/SetNavigation";
import TrendsSidebar from "@/components/TrendsSidebar";
import { getTranslation } from "@/lib/language";
import ActiveSessions from "@/components/settings/ActiveSessions";
import SessionsHeader from "./SessionsHeader";

export default async function ActiveSessionsPage() {
  const { settings } = await getTranslation();
  
  return (
    <>
      <SetNavigation navPage="settings" />
      <div className="w-full h-full max-h-full overflow-y-auto min-w-0 max-w-lg space-y-2 sm:space-y-5 max-sm:pb-16">
        <SessionsHeader />

        <div className="bg-card/50 p-5 shadow-sm sm:rounded-2xl sm:bg-card">
          <ActiveSessions />
        </div>
      </div>
      <TrendsSidebar />
    </>
  );
}
