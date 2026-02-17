import { validateRequest } from "@/auth";
import { redirect } from "next/navigation";
import { EmptySession } from "../(main)/SessionProvider";
import { ProgressProvider } from "@/context/ProgressContext";
import { Toaster } from "@/components/ui/toaster";
import { LanguageProvider } from "@/context/LanguageContext";
import AuthLayoutClient from "./AuthLayoutClient";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await validateRequest();

  if (user) {
    // Le redirection ne sera fait que côté client si pas en switching mode
    // Le composant client gère le switching param
  }
  return (
    <ProgressProvider>
      <EmptySession>
        <LanguageProvider>
          <Toaster />
          <AuthLayoutClient user={user}>
            {children}
          </AuthLayoutClient>
        </LanguageProvider>
      </EmptySession>
    </ProgressProvider>
  );
}
