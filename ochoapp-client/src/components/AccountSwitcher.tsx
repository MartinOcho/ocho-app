"use client";

import { useEffect, useState, useCallback } from "react";
import {
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import { ArrowRightLeftIcon, Plus, Settings, Check, Loader2 } from "lucide-react";
import UserAvatar from "./UserAvatar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { switchAccount } from "@/app/(auth)/actions";
import kyInstance from "@/lib/ky";
import OchoLink from "./ui/OchoLink";
import { useTranslation } from "@/context/LanguageContext";
import { useRouter } from "next/navigation";
import { useToast } from "./ui/use-toast";

interface SessionAccount {
  sessionId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  expiresAt: Date;
}

interface CurrentSession {
  sessionId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

interface AccountSwitcherProps {
  currentUserId: string;
}

interface SessionsResponse {
  sessions: SessionAccount[];
  currentSession: CurrentSession;
}

interface SessionsApiResponse {
  sessions: SessionAccount[];
  currentSession: CurrentSession;
}

async function fetchSessions(): Promise<SessionsResponse> {
  const data = await kyInstance("/api/auth/sessions", {
    method: "GET",
    credentials: "include",
  }).json<SessionsApiResponse>();

  return {
    sessions: data.sessions || [],
    currentSession: data.currentSession,
  };
}

export default function AccountSwitcher({ currentUserId }: AccountSwitcherProps) {
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchingSessionId, setSwitchingSessionId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const router = useRouter();
  const { toast } = useToast();

  // Utiliser React Query avec cache de 5 minutes
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["user-sessions", currentUserId],
    queryFn: fetchSessions,
    staleTime: 5 * 60 * 1000, // 5 minutes de cache
    gcTime: 10 * 60 * 1000, // Garder en mémoire 10 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const sessions = data?.sessions || [];
  const currentSession = data?.currentSession;

  const handleSwitchAccount = async (sessionId: string, displayName: string) => {
    try {
      setIsSwitching(true);
      setSwitchingSessionId(sessionId);

      toast({
        title: t("switchingAccount"),
        description: t("switchingTo").replace("[account]", displayName),
      });
      
      await switchAccount(sessionId);
      queryClient.invalidateQueries();
      // Afficher un toast de confirmation
      toast({
        title: t("accountSwitched") || "Compte changé",
        description: t("switchedTo").replace("[account]", displayName),
      });
      
      // Invalider les queries et recharger les données
      await queryClient.invalidateQueries({ queryKey: ["user-sessions"] });
      
      // Attendre un peu pour que le refresh se termine
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Utiliser router.refresh() pour une meilleure intégration Next.js
      router.refresh();
    } catch (error) {
      console.error("Erreur lors du changement de compte:", error);
      toast({
        title: t("error"),
        description: t("switchAccountError"),
        variant: "destructive",
      });
      setIsSwitching(false);
      setSwitchingSessionId(null);
    }
  };

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <ArrowRightLeftIcon className="mr-2 size-4" />
        {t("switchAccount")}
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent className="min-w-36 max-sm:max-w-40">
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
          ) : (
            <>
              {/* Compte actuel */}
              {currentSession && (
                <>
                  <DropdownMenuItem disabled className="flex items-center gap-2">
                    <UserAvatar
                      userId={currentSession.userId}
                      avatarUrl={currentSession.avatarUrl}
                      size={24}
                      hideBadge={true}
                    />
                    <div className="flex flex-col flex-1">
                      <span className="text-sm font-medium">
                        {currentSession.displayName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        @{currentSession.username}
                      </span>
                    </div>
                    <Check className="size-4 text-emerald-500 flex-shrink-0" />
                  </DropdownMenuItem>
                  {sessions.length > 0 && <DropdownMenuSeparator />}
                </>
              )}

              {/* Autres comptes */}
              {sessions.length === 0 ? (
                <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                  {t("noOtherSessions")}
                </DropdownMenuItem>
              ) : (
                sessions.map((account) => (
                  <DropdownMenuItem
                    key={account.sessionId}
                    onClick={() => handleSwitchAccount(account.sessionId, account.displayName)}
                    disabled={isSwitching}
                    className="flex items-center gap-2"
                  >
                    <UserAvatar
                      userId={account.userId}
                      avatarUrl={account.avatarUrl}
                      size={24}
                      hideBadge={true}
                    />
                    <div className="flex flex-col flex-1">
                      <span className="text-sm font-medium">
                        {account.displayName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        @{account.username}
                      </span>
                    </div>
                    {switchingSessionId === account.sessionId && (
                      <Loader2 className="size-4 animate-spin text-primary flex-shrink-0" />
                    )}
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
            </>
          )}
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}

