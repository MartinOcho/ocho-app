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
          const deeplink = "ochoapp://home";
          const downloadUrl = "/android/download"; // Route relative

          toast({
            title: "Ouvrez OchoApp mobile",
            description: "Profitez d'une meilleure expérience sur OchoApp mobile avec des fonctionnalités exclusives.",
            action: (
              <>
                <ToastAction altText="Ouvrir" onClick={() => window.open(deeplink)}>Ouvrir</ToastAction>
                <ToastAction altText="Télécharger" onClick={() => window.location.href = downloadUrl}>Télécharger</ToastAction>
              </>
            ),
          });
        }
      }
  }, [toast]);

  return null;
}