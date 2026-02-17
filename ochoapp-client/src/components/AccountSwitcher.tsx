"use client";

import { useEffect, useState } from "react";
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
import { useQueryClient } from "@tanstack/react-query";
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

export default function AccountSwitcher({ currentUserId }: AccountSwitcherProps) {
  const [sessions, setSessions] = useState<SessionAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  useEffect(() => {
    const loadSessions = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/auth/sessions", {
          method: "GET",
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          // data.sessions contient les autres sessions du même device
          setSessions(data.sessions || []);
        }
      } catch (error) {
        console.error("Erreur lors du chargement des sessions:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSessions();
  }, [currentUserId]);

  const handleSwitchAccount = async (sessionId: string) => {
    try {
      setIsSwitching(true);
      await switchAccount(sessionId);
      // Invalider les queries pour rafraîchir les données
      queryClient.invalidateQueries();
      // Recharger la page pour mettre à jour la session
      window.location.reload();
    } catch (error) {
      console.error("Erreur lors du changement de compte:", error);
    } finally {
      setIsSwitching(false);
    }
  };

  // Si aucune autre session n'est disponible sur ce device
  if (isLoading || sessions.length === 0) {
    return (
      <OchoLink href="/login?switching=true" className="text-inherit">
        <DropdownMenuItem className="flex items-center gap-2 text-primary">
          <Plus className="size-4" />
          <span>{t("addAccount")}</span>
        </DropdownMenuItem>
      </OchoLink>
    );
  }

  return (
    <>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <ArrowRightLeftIcon className="mr-2 size-4" />
          {t("switchAccount")}
        </DropdownMenuSubTrigger>
        <DropdownMenuPortal>
          <DropdownMenuSubContent className="min-w-52">
            {sessions.map((account) => (
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
            ))}
            
            <DropdownMenuSeparator />
            
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
    </>
  );
}

