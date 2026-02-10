import SetNavigation from "@/components/SetNavigation";
import TrendsSidebar from "@/components/TrendsSidebar";
import Options from "./Options";
import { getTranslation } from "@/lib/language";

export default async function page() {
  const { settings } = await getTranslation();
  return (
    <>
      <SetNavigation navPage="settings" />
      <div className="w-full min-w-0 max-w-lg space-y-2 sm:space-y-5 max-sm:pb-16">
        <div className="bg-card/50 p-5 shadow-sm sm:rounded-2xl sm:bg-card">
          <h2 className="text-center text-2xl font-bold">{settings}</h2>
        </div>
        <Options />
      </div>
      <TrendsSidebar />
    </>
  );
}
