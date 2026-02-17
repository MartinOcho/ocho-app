"use client";

import { LanguageProvider } from "@/context/LanguageContext";
import { Session, User } from "lucia";
import { createContext, useContext } from "react";

interface SessionContext {
  user: User;
  session: Session;
  token?: string;
}

const SessionContext = createContext<SessionContext | null>(null);

export default function SessionProvider({
  children,
  value,
}: React.PropsWithChildren<{ value: SessionContext }>) {
  // Les sessions sont maintenant gérées sécurisément via le backend (Lucia)
  // Aucune sauvegarde en localStorage n'est nécessaire

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}

export function EmptySession({ children }: React.PropsWithChildren) {
  const session = {
    user: {} as User,
    session: {} as Session,
  };
  return (
    <SessionProvider value={session}>
      <LanguageProvider>{children}</LanguageProvider>
    </SessionProvider>
  );
}
