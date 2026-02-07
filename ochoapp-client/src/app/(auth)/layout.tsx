import { validateRequest } from "@/auth";
import { redirect } from "next/navigation";
import { EmptySession } from "../(main)/SessionProvider";
import { ProgressProvider } from "@/context/ProgressContext";
import { Toaster } from "@/components/ui/toaster";
import { LanguageProvider } from "@/context/LanguageContext";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await validateRequest();

  if (user) redirect("/");
  return (
    <ProgressProvider>
      <EmptySession>
        <LanguageProvider>
      <Toaster/>
        <main className="flex h-screen max-h-vh items-center justify-center p-5">
          <div className="flex flex-col items-center justify-between gap-5 h-full">
            {children}
            <div className="privacy text-muted-foreground text-center px-1 text-sm">
              <p>En utilisant OchoApp, vous acceptez les présentes <a href="/terms-of-use" className="text-primary hover:underline max-sm:underline">Conditions d&apos;Utilisation</a> et avez lu la <a href="/privacy" className="text-primary hover:underline max-sm:underline">politique de confidentialité</a>.</p>
            </div>
          </div>
        </main>

        </LanguageProvider>
      </EmptySession>
    </ProgressProvider>
  );
}
