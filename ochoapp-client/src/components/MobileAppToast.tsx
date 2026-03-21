"use client";

import { useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";

export default function MobileAppToast() {
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== "undefined") {
        const isAndroid = /Android/i.test(navigator.userAgent);
        if (isAndroid) {
          // Essayer d'ouvrir l'app
          const deeplink = "ochoapp://home";
          const downloadUrl = "/android/download"; // Route relative

          // Timeout pour détecter si l'app s'ouvre
          const timeout = setTimeout(() => {
            toast({
              title: "Téléchargez l'application mobile",
              description: "Profitez d'une meilleure expérience sur OchoApp mobile avec des fonctionnalités exclusives.",
              action: <ToastAction altText="Télécharger" onClick={() => window.location.href = downloadUrl}>Télécharger</ToastAction>,
            });
          }, 2000);

          // Essayer d'ouvrir le deeplink
          window.open(deeplink, "_blank");

          // Nettoyer le timeout si l'app s'ouvre (page perd le focus)
          window.addEventListener("blur", () => {
            clearTimeout(timeout);
          }, { once: true });
        }
      }
  }, [toast]);

  return null;
}