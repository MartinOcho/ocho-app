"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import DeviceInitializer from "@/components/DeviceInitializer";
import { OfflineIndicator } from "@/components/OfflineIndicator";

export default function ReactQueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Résilience offline: retry et revalidation
        retry: (failureCount, error: any) => {
          // Ne pas retry si c'est une erreur 4xx
          if (error?.status >= 400 && error?.status < 500) {
            return false
          }
          // Retry jusqu'à 3 fois pour les erreurs réseau
          return failureCount < 3
        },
        retryDelay: (attemptIndex) => {
          // Délai exponentiel: 1s, 2s, 4s
          return Math.min(1000 * 2 ** attemptIndex, 30000)
        },
        // Garder les données en cache 5 minutes
        staleTime: 5 * 60 * 1000,
        // Garder les données même si la query devient inactive
        gcTime: 10 * 60 * 1000,
      },
      mutations: {
        retry: (failureCount) => failureCount < 2,
        retryDelay: (attemptIndex) => {
          return Math.min(1000 * 2 ** attemptIndex, 30000)
        },
      },
    },
  }));

  return <QueryClientProvider client={client}>
    <DeviceInitializer />
    <OfflineIndicator />
    {children}
    {/* <ReactQueryDevtools initialIsOpen={false} /> */}
  </QueryClientProvider>
}
