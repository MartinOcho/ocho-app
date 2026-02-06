import { Button } from "@/components/ui/button";
import { AlertCircle, AlertTriangle, Ban, LogOut, Trash2, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

interface UnavailableFooterProps {
  stateText: string;
  buttonLabel: string;
  onButtonClick?: () => void;
  buttonColor?: string;
  textColor?: string;
  icon?: React.ReactNode;
}

export function UnavailableFooter({
  stateText,
  buttonLabel,
  onButtonClick,
  buttonColor,
  textColor,
  icon,
}: UnavailableFooterProps) {
  return (
    <div className="relative max-sm:flex-col flex w-full select-none items-center justify-center gap-3 rounded-3xl border border-destructive/30 bg-destructive/5 p-3 px-5">
      <div className="flex items-center gap-2">
        {icon || <AlertTriangle className="h-5 w-5 text-destructive" />}
        <p className="text-center font-semibold text-destructive">{stateText}</p>
      </div>
      {buttonLabel && (
        <Button
          size="sm"
          onClick={onButtonClick}
          className={cn("ml-auto flex-shrink-0", buttonColor && `bg-[${buttonColor}]`)}
        >
          {buttonLabel}
        </Button>
      )}
    </div>
  );
}

interface LoadingFooterProps {
  onClose?: () => void;
}

export function LoadingFooter({ onClose }: LoadingFooterProps) {
  return (
    <div className="relative flex w-full select-none items-center justify-center gap-2 rounded-3xl border border-input bg-background/50 p-3 px-5 animate-pulse">
      <div className="h-4 w-4 rounded-full bg-muted-foreground/50"></div>
      <p className="text-center font-semibold text-muted-foreground">Chargement...</p>
    </div>
  );
}

interface UserLeftFooterProps {
  onContactAdmin?: () => void;
}

export function UserLeftFooter({ onContactAdmin }: UserLeftFooterProps) {
  return (
    <UnavailableFooter
      stateText="Vous avez quitté le groupe"
      buttonLabel="Contacter un administrateur"
      onButtonClick={onContactAdmin}
      icon={<LogOut className="h-5 w-5 text-orange-500" />}
    />
  );
}

interface UserKickedFooterProps {
  onContactAdmin?: () => void;
}

export function UserKickedFooter({ onContactAdmin }: UserKickedFooterProps) {
  return (
    <UnavailableFooter
      stateText="Un administrateur vous a retiré du groupe"
      buttonLabel="Contacter un administrateur"
      onButtonClick={onContactAdmin}
      icon={<AlertTriangle className="h-5 w-5 text-orange-500" />}
    />
  );
}

interface UserDeletedFooterProps {
  onDeleteConversation?: () => void;
}

export function UserDeletedFooter({ onDeleteConversation }: UserDeletedFooterProps) {
  return (
    <UnavailableFooter
      stateText="Compte supprimé"
      buttonLabel="Supprimer la discussion"
      onButtonClick={onDeleteConversation}
      icon={<Trash2 className="h-5 w-5 text-red-500" />}
    />
  );
}

interface UserBannedFooterProps {
  onContactSupport?: () => void;
}

export function UserBannedFooter({ onContactSupport }: UserBannedFooterProps) {
  return (
    <UnavailableFooter
      stateText="Vous avez été banni"
      buttonLabel="Contacter le support"
      onButtonClick={onContactSupport}
      icon={<Ban className="h-5 w-5 text-destructive" />}
    />
  );
}

interface PrivateProfileFooterProps {
  onFollowUser?: () => void;
}

export function PrivateProfileFooter({ onFollowUser }: PrivateProfileFooterProps) {
  return (
    <UnavailableFooter
      stateText="Profil privé"
      buttonLabel="Suivre pour discuter"
      onButtonClick={onFollowUser}
      icon={<Heart className="h-5 w-5 text-pink-500" />}
    />
  );
}

interface GroupFullFooterProps {
  onViewDetails?: () => void;
}

export function GroupFullFooter({ onViewDetails }: GroupFullFooterProps) {
  return (
    <UnavailableFooter
      stateText="Groupe plein"
      buttonLabel="Voir les détails"
      onButtonClick={onViewDetails}
      icon={<AlertCircle className="h-5 w-5 text-yellow-500" />}
    />
  );
}

interface UnspecifiedFooterProps {
  onContactSupport?: () => void;
}

export function UnspecifiedFooter({ onContactSupport }: UnspecifiedFooterProps) {
  return (
    <UnavailableFooter
      stateText="L'envoi de message n'est pas disponible"
      buttonLabel="Contacter le support"
      onButtonClick={onContactSupport}
      icon={<AlertCircle className="h-5 w-5 text-muted-foreground" />}
    />
  );
}
