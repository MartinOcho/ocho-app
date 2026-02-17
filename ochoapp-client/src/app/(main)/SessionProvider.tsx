"use client";

import { LanguageProvider } from "@/context/LanguageContext";
import { Session, User } from "lucia";
import { createContext, useContext, useEffect } from "react";
import { saveAccount } from "@/lib/account-switcher";

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
  // Sauvegarder automatiquement le compte lors de la première connexion
  useEffect(() => {
    if (value.user && value.user.id) {
      saveAccount({
        sessionId: value.session.id,
        userId: value.user.id,
        username: value.user.username,
        displayName: value.user.displayName,
        avatarUrl: value.user.avatarUrl,
      });
    }
  }, [value.user?.id, value.session.id]);

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
