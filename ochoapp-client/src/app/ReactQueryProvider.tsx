"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import DeviceInitializer from "@/components/DeviceInitializer";

export default function ReactQueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [client] = useState(new QueryClient());

  return <QueryClientProvider client={client}>
    <DeviceInitializer />
    {children}
    {/* <ReactQueryDevtools initialIsOpen={false} /> */}
  </QueryClientProvider>
}
