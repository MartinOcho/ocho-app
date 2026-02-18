"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import UserAvatar from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import LoadingButton from "@/components/LoadingButton";
import { LogOut, LogOutIcon } from "lucide-react";
import { logoutSpecificSession, logoutAllOtherSessions, getAvailableAccounts } from "@/app/(auth)/actions";
import OchoLink from "@/components/ui/OchoLink";
import { useTranslation } from "@/context/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Account {
  sessionId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  expiresAt: Date;
  isCurrent: boolean;
  deviceCount: number;
}

export default function LogoutAccountsClient() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loggingOutId, setLoggingOutId] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    async function loadAccounts() {
      try {
        const result = await getAvailableAccounts();
        setCurrentUser(result.currentUser);
        setAccounts(result.accounts);
      } catch (error) {
        console.error("Erreur lors du chargement des comptes:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadAccounts();
  }, []);

  const handleLogoutAccount = async (sessionId: string) => {
    try {
      setLoggingOutId(sessionId);
      await logoutSpecificSession(sessionId);
      // Retirer le compte de la liste
      setAccounts((prev) => prev.filter((acc) => acc.sessionId !== sessionId));
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error);
      alert("Erreur lors de la déconnexion du compte");
    } finally {
      setLoggingOutId(null);
    }
  };

  const handleLogoutAllOthers = async () => {
    setShowConfirmDialog(true);
  };

  const confirmLogoutAllOthers = async () => {
    try {
      setLoggingOutId("all");
      setShowConfirmDialog(false);
      await logoutAllOtherSessions();
      // Garder seulement le compte courant
      setAccounts((prev) => prev.filter((acc) => acc.isCurrent));
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error);
      alert("Erreur lors de la déconnexion des comptes");
    } finally {
      setLoggingOutId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const otherAccounts = accounts.filter((acc) => !acc.isCurrent);
  const currentAccount = accounts.find((acc) => acc.isCurrent);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">{t("manageAccounts")}</h1>
        <p className="text-muted-foreground">
          {t("logoutAllDescription")}
        </p>
      </div>

      {/* Compte courant */}
      {currentAccount && (
        <div className="mb-8 p-4 border rounded-lg bg-card">
          <h2 className="text-lg font-semibold mb-4">{t("currentSession")}</h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <UserAvatar
                userId={currentAccount.userId}
                avatarUrl={currentAccount.avatarUrl}
                size={48}
              />
              <div>
                <p className="font-medium">{currentAccount.displayName}</p>
                <p className="text-sm text-muted-foreground">@{currentAccount.username}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {currentAccount.deviceCount} {currentAccount.deviceCount === 1 ? "appareil" : "appareils"}
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm font-medium">
              {t("active")}
            </span>
          </div>
        </div>
      )}

      {/* Autres comptes */}
      {otherAccounts.length > 0 ? (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">
            {t("otherSessions")} ({otherAccounts.length})
          </h2>
          <div className="space-y-3">
            {otherAccounts.map((account) => (
              <div
                key={account.sessionId}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <UserAvatar
                    userId={account.userId}
                    avatarUrl={account.avatarUrl}
                    size={40}
                  />
                  <div>
                    <p className="font-medium">{account.displayName}</p>
                    <p className="text-sm text-muted-foreground">@{account.username}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {account.deviceCount} {account.deviceCount === 1 ? "appareil" : "appareils"}
                    </p>
                  </div>
                </div>
                <LoadingButton
                  onClick={() => handleLogoutAccount(account.sessionId)}
                  loading={loggingOutId === account.sessionId}
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  {t("logout")}
                </LoadingButton>
              </div>
            ))}
          </div>

          {/* Bouton déconnecter tous les autres */}
          <div className="mt-6 p-4 border border-yellow-500/30 bg-yellow-500/5 rounded-lg">
            <p className="text-sm text-muted-foreground mb-3">
              {t("logoutAllDescription")}
            </p>
            <LoadingButton
              onClick={handleLogoutAllOthers}
              loading={loggingOutId === "all"}
              variant="outline"
              className="text-yellow-600 border-yellow-600 hover:bg-yellow-500/10"
            >
              <LogOutIcon className="w-4 h-4 mr-2" />
              {t("logoutAllOthers")}
            </LoadingButton>
          </div>
        </div>
      ) : (
        <div className="p-6 border rounded-lg bg-muted/50 text-center">
          <p className="text-muted-foreground">{t("noOtherSessions")}</p>
        </div>
      )}

      {/* Bouton retour */}
      <div className="mt-8 flex gap-3">
        <OchoLink href="/">
          <Button variant="outline" className="flex-1">
            {t("back")}
          </Button>
        </OchoLink>
      </div>

      {/* Info de sécurité */}
      <div className="mt-8 p-4 border border-blue-500/30 bg-blue-500/5 rounded-lg">
        <p className="text-xs text-muted-foreground">
          💡 {t("securityNote")}
        </p>
      </div>

      {/* Dialog de confirmation */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmLogoutAll")}</DialogTitle>
            <DialogDescription>
              {t("confirmLogoutAllDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
            >
              {t("cancel")}
            </Button>
            <LoadingButton
              onClick={confirmLogoutAllOthers}
              loading={loggingOutId === "all"}
              variant="destructive"
            >
              {t("logout")}
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
