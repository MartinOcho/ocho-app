import SetNavigation from "@/components/SetNavigation";
import TrendsSidebar from "@/components/TrendsSidebar";
import DeleteAccountRequestForm from "./DeleteAccountRequestForm";

export default function DeleteAccountRequestPage() {
  return (
    <>
      <SetNavigation navPage="settings" />
      <div className="w-full h-full min-w-0 max-w-lg space-y-5 max-sm:pb-16">
        <DeleteAccountRequestForm />
      </div>
      <TrendsSidebar />
    </>
  );
}
