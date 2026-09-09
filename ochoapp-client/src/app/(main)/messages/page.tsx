// "use client"

import { Metadata } from "next";
import MessagesPage from "./MessagesPage";
import SetNavigation from "@/components/SetNavigation";
import { validateRequest } from "@/auth";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Messages",
};

export default async function Page() {
  const { user } = await validateRequest();

  if (!user) {
    notFound();
  }

  return (
    <div className="relative max-h-full w-fit sm:w-full overflow-hidden">
      <SetNavigation navPage="messages" />
      <MessagesPage />
    </div>
  );
}
