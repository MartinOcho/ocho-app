"use client";

import { useDeviceId } from "@/hooks/useDeviceId";

export default function DeviceInitializer() {
  // Initialiser le deviceId au chargement
  useDeviceId();
  
  return null; // Ce composant ne rend rien, c'est juste pour initialiser
}
