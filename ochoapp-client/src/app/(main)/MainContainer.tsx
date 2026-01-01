"use client";

import Navbar from "./Navbar";
import MenuBar from "./MenuBar";
import { MenuBarProvider } from "@/context/MenuBarContext";
import BottomMenuBar from "@/components/BottomMenuBar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <MenuBarProvider>
      <div className="relative flex h-[100vh] max-h-[100vh] min-h-[100vh] w-full flex-col">
        <Navbar />
        <div className="relative h-full max-h-full w-full overflow-hidden">
          <div className="mx-auto flex h-full max-h-full w-full max-w-7xl gap-5 overflow-auto sm:p-5">
            <MenuBar className="sticky top-0 hidden h-fit flex-none space-y-3 rounded-2xl bg-card px-3 py-5 sm:block lg:px-5 xl:w-72" />
            {children}
          </div>
        </div>
        <BottomMenuBar/>
      </div>
    </MenuBarProvider>
  );
}
