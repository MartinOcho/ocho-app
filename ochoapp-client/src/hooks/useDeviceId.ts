import kyInstance from "@/lib/ky";
import { useEffect, useState } from "react";

export function useDeviceId() {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeDeviceId = async () => {
      try {
        const response = await kyInstance.get("/api/auth/device-id").json<{ deviceId: string | null }>();

        if (response.deviceId) {
          setDeviceId(response.deviceId);
        }
      } catch (error) {
        console.error("Erreur lors de l'initialisation du deviceId:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeDeviceId();
  }, []);

  return { deviceId, isLoading };
}
