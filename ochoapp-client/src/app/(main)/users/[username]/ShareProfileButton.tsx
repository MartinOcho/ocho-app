"use client";

import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";import { useTranslation } from "@/context/LanguageContext";
import { toast } from "@/components/ui/use-toast";

interface ShareProfileButtonProps {
  username: string;
  displayName: string;
}

export default function ShareProfileButton({
  username,
  displayName,
}: ShareProfileButtonProps) {
  const { t } = useTranslation();

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/users/${username}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `OchoApp - ${displayName}`,
          text: `Découvrez le profil de ${displayName} (@${username}) sur OchoApp`,
          url: shareUrl,
        });
      } catch (err) {
        console.error("Error sharing:", err);
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        description: t().linkCopied,
      });
    }
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleShare}
      title="Partager le profil"
    >
      <Share2 className="size-5" />
    </Button>
  );
}
