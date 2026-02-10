// "use client"

import { Metadata } from "next";
import MessagesPage from "./MessagesPage";
import SetNavigation from "@/components/SetNavigation";

export const metadata: Metadata = {
  title: "Messages",
};

export default function Page() {
  return (
    <div className="relative max-h-full w-fit sm:w-full overflow-hidden">
      <SetNavigation navPage="messages" />
      <MessagesPage />
    </div>
  );
}
