"use client";

import { useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";

export default function MobileAppToast() {
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const fromLogin = urlParams.get("fromLogin");
      if (fromLogin) {
        const isAndroid = /Android/i.test(navigator.userAgent);
        if (isAndroid) {
          // Essayer d'ouvrir l'app
          const deeplink = "ochoapp://home";
          const downloadUrl = "/android/download"; // Route relative

          // Créer un lien temporaire pour tester le deeplink
          const link = document.createElement("a");
          link.href = deeplink;
          link.style.display = "none";
          document.body.appendChild(link);

          // Timeout pour détecter si l'app s'ouvre
          const timeout = setTimeout(() => {
            // Si après 2 secondes la page est encore là, l'app n'est pas installée
            toast({
              title: "Téléchargez l'application mobile",
              description: "Profitez d'une meilleure expérience sur OchoApp mobile.",
              action: <ToastAction altText="Télécharger" onClick={() => window.location.href = downloadUrl}>Télécharger</ToastAction>,
            });
            document.body.removeChild(link);
          }, 2000);

          // Essayer d'ouvrir le deeplink
          link.click();

          // Nettoyer le timeout si l'app s'ouvre
          window.addEventListener("blur", () => {
            clearTimeout(timeout);
            document.body.removeChild(link);
          }, { once: true });
        }
      }
    }
  }, [toast]);

  return null;
}