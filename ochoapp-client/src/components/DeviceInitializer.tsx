"use client";

import { useDeviceId } from "@/hooks/useDeviceId";

export default function DeviceInitializer() {
  useDeviceId();
  
  return null;
}
