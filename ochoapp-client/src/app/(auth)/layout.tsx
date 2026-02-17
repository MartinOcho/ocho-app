import { validateRequest } from "@/auth";
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
