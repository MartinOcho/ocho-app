"use client";

import { useState } from "react";
import {
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import { ArrowRightLeftIcon, Plus, Settings } from "lucide-react";
import UserAvatar from "./UserAvatar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { switchAccount } from "@/app/(auth)/actions";
import OchoLink from "./ui/OchoLink";
import { useTranslation } from "@/context/LanguageContext";

interface SessionAccount {
  sessionId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  expiresAt: Date;
}

interface AccountSwitcherProps {
  currentUserId: string;
}

async function fetchSessions(): Promise<SessionAccount[]> {
  const response = await fetch("/api/auth/sessions", {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Erreur lors du chargement des sessions: ${response.status}`);
  }

  const data = await response.json();
  return data.sessions || [];
}

export default function AccountSwitcher({ currentUserId }: AccountSwitcherProps) {
  const [isSwitching, setIsSwitching] = useState(false);
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  // Utiliser React Query avec cache de 5 minutes
  const { data: sessions = [], isLoading, error, refetch } = useQuery({
    queryKey: ["user-sessions", currentUserId],
    queryFn: fetchSessions,
    staleTime: 5 * 60 * 1000, // 5 minutes de cache
    gcTime: 10 * 60 * 1000, // Garder en mémoire 10 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const handleSwitchAccount = async (sessionId: string) => {
    try {
      setIsSwitching(true);
      await switchAccount(sessionId);
      // Invalider les queries et recharger les données
      await queryClient.invalidateQueries({ queryKey: ["user-sessions"] });
      // Recharger la page pour mettre à jour la session
      window.location.reload();
    } catch (error) {
      console.error("Erreur lors du changement de compte:", error);
      setIsSwitching(false);
    }
  };

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <ArrowRightLeftIcon className="mr-2 size-4" />
        {t("switchAccount")}
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent className="min-w-52">
          {/* État de chargement */}
          {isLoading ? (
            <DropdownMenuItem disabled className="text-xs text-muted-foreground">
              {t("loading") || "Chargement..."}
            </DropdownMenuItem>
          ) : error ? (
            <>
              <DropdownMenuItem disabled className="text-xs text-destructive">
                Erreur lors du chargement
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => refetch()}
                className="text-xs text-primary"
              >
                Réessayer
              </DropdownMenuItem>
            </>
          ) : sessions.length === 0 ? (
            <DropdownMenuItem disabled className="text-xs text-muted-foreground">
              {t("noOtherSessions") || "Aucun autre compte"}
            </DropdownMenuItem>
          ) : (
            sessions.map((account) => (
              <DropdownMenuItem
                key={account.sessionId}
                onClick={() => handleSwitchAccount(account.sessionId)}
                disabled={isSwitching}
                className="flex items-center gap-2"
              >
                <UserAvatar
                  userId={account.sessionId}
                  avatarUrl={account.avatarUrl}
                  size={24}
                  hideBadge={true}
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {account.displayName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    @{account.username}
                  </span>
                </div>
              </DropdownMenuItem>
            ))
          )}

          {sessions.length > 0 && <DropdownMenuSeparator />}

          {/* Lien vers la gestion des comptes */}
          {sessions.length > 0 && (
            <OchoLink href="/logout-accounts" className="text-inherit">
              <DropdownMenuItem className="flex items-center gap-2">
                <Settings className="size-4" />
                <span>{t("manageAccounts") || "Gérer les comptes"}</span>
              </DropdownMenuItem>
            </OchoLink>
          )}

          <OchoLink href="/login?switching=true" className="text-inherit">
            <DropdownMenuItem className="flex items-center gap-2 text-primary">
              <Plus className="size-4" />
              <span>{t("addAccount")}</span>
            </DropdownMenuItem>
          </OchoLink>
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}

