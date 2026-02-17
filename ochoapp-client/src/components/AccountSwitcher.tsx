"use client";

import { useEffect, useState } from "react";
import {
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
  DropdownMenuItem,
} from "./ui/dropdown-menu";
import { LogIn, Plus } from "lucide-react";
import { StoredAccount, getStoredAccounts } from "@/lib/account-switcher";
import UserAvatar from "./UserAvatar";
import { useQueryClient } from "@tanstack/react-query";
import { switchAccount } from "@/app/(auth)/actions";
import OchoLink from "./ui/OchoLink";
import { useTranslation } from "@/context/LanguageContext";

interface AccountSwitcherProps {
  currentUserId: string;
}

export default function AccountSwitcher({ currentUserId }: AccountSwitcherProps) {
  const [accounts, setAccounts] = useState<StoredAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  useEffect(() => {
    const storedAccounts = getStoredAccounts().filter(
      (acc) => acc.userId !== currentUserId
    );
    setAccounts(storedAccounts);
  }, [currentUserId]);

  const handleSwitchAccount = async (account: StoredAccount) => {
    try {
      setIsLoading(true);
      await switchAccount(account.sessionId);
      // Invalider les queries pour rafraîchir les données
      queryClient.invalidateQueries();
      // Recharger la page pour mettre à jour la session
      window.location.reload();
    } catch (error) {
      console.error("Erreur lors du changement de compte:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <LogIn className="mr-2 size-4" />
        {t("switchAccount")}
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent className="min-w-52">
          {accounts.map((account) => (
            <DropdownMenuItem
              key={account.userId}
              onClick={() => handleSwitchAccount(account)}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <UserAvatar
                userId={account.userId}
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
          <OchoLink href="/login" className="text-inherit">
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
