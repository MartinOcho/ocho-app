"use client";

import MenuBar from "@/app/(main)/MenuBar";
import { useMenuBar } from "@/context/MenuBarContext";
import { cn } from "@/lib/utils";

export default function BottomMenuBar() {
  const { isVisible } = useMenuBar();

  return (
    <MenuBar
      className={cn(
        `sticky bottom-0 inline-flex min-h-fit w-full max-w-full justify-around gap-0 overflow-x-hidden border-t bg-card p-1 transition-[bottom] *:rounded-md sm:hidden`,
        !isVisible && "fixed bottom-[-100%]",
      )}
    />
  );
}
