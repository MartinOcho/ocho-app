import SetNavigation from "@/components/SetNavigation";
import TrendsSidebar from "@/components/TrendsSidebar";
import Options from "../Options";
import { getTranslation } from "@/lib/language";

interface PageProps {
  params: Promise<{ setting: string }>;
}

export default async function page({ params } : PageProps) {
  const { setting } = await params;

  const { settings } =
    await getTranslation();
        
  return (
    <>
      <SetNavigation navPage="settings" />
      <div className="w-full h-full max-h-full overflow-y-auto  min-w-0 space-y-2 sm:space-y-5 max-w-lg">
        <div className="bg-card/50 p-5 shadow-sm sm:rounded-2xl sm:bg-card">
          <h2 className="text-center text-2xl font-bold">{settings}</h2>
        </div>
        <Options setting={setting} subOption/>
      </div>
      <TrendsSidebar />
    </>
  );
}