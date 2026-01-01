"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LoaderMain() {
  return <span className="animate-scale duration-500">
    <Loader2 className={cn("animate-spin w-7 transition-all")} />
  </span>
}
