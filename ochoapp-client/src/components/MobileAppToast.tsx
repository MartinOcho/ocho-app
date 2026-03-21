"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MobileAppToast() {
  const [isAndroid, setIsAndroid] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isAndroidDevice = /Android/i.test(navigator.userAgent);
      if (isAndroidDevice) {
        setIsAndroid(true);
        setIsVisible(true);
      }
    }
  }, []);

  if (!isAndroid || !isVisible) {
    return null;
  }

  const deeplink = "ochoapp://home";
  const downloadUrl = "/android/download";

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-black/40 p-4 z-50 animate-in slide-in-from-bottom-4">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Ouvrez OchoApp mobile
            </h3>
            <p className="text-sm text-gray-600">
              Profitez d'une meilleure expérience sur OchoApp mobile avec des fonctionnalités exclusives.
            </p>
          </div>
          <button
            onClick={() => setIsVisible(false)}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          <Button
            onClick={() => window.open(deeplink)}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            Ouvrir
          </Button>
          <Button
            onClick={() => window.open(downloadUrl, "_blank")}
            variant="outline"
            className="flex-1"
          >
            Télécharger
          </Button>
        </div>
      </div>
    </div>
  );
}