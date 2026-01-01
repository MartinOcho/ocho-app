"use client";

import { useSession } from "@/app/(main)/SessionProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuSubContent,
} from "./ui/dropdown-menu";
import UserAvatar from "./UserAvatar";
import OchoLink from "@/components/ui/OchoLink";
import {
  Check,
  LogOutIcon,
  PaintbrushVertical,
  Moon,
  Sun,
  UserRound,
} from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import kyInstance from "@/lib/ky";
import { Language, VocabularyKey, VocabularyObject } from "@/lib/vocabulary";
import { t, useLanguage } from "@/context/LanguageContext";
import US from "./flags/US";
import French from "./flags/French";

interface UserButtonProps {
  className?: string;
}

export default function UserButton({ className }: UserButtonProps) {
  const { user } = useSession();
  const { language, setLanguage } = useLanguage();

  const {
    loggedIn,
    profile,
    theme: themeText,
    logout: logoutText,
    light,
    dark,
    language: languageText,
    systemDefault,
  }: VocabularyObject = t();

  const { theme, setTheme } = useTheme();

  const queryClient = useQueryClient();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn("aspect-square flex-none rounded-full", className)}
          title={profile}
        >
          <UserAvatar userId={user.id} avatarUrl={user.avatarUrl} size={40} hideBadge={false} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel className="max-sm:max-w-36">
          {loggedIn} @{user.username}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <OchoLink href={`/users/${user.username}`} className="text-inherit">
          <DropdownMenuItem>
            <UserRound className="mr-2 size-4 rounded-full" />
            {profile}
          </DropdownMenuItem>
        </OchoLink>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {theme === "system" && (
              <PaintbrushVertical className="mr-2 size-4" />
            )}
            {theme === "light" && <Sun className="mr-2 size-4" />}
            {theme === "dark" && <Moon className="mr-2 size-4" />}
            {themeText}
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="max-sm:max-w-48">
              <DropdownMenuItem
                onClick={() => {
                  setTheme("system");
                }}
              >
                <PaintbrushVertical className="mr-2 size-4" />
                {systemDefault}
                {theme === "system" && <Check className="ms-2 size-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setTheme("light");
                }}
              >
                <Sun className="mr-2 size-4" />
                {light}
                {theme === "light" && <Check className="ms-2 size-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setTheme("dark");
                }}
              >
                <Moon className="mr-2 size-4" />
                {dark}
                {theme === "dark" && <Check className="ms-2 size-4" />}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="max-sm:hidden">
            {language === "fr" && <French className="mr-2 size-4" />}
            {language === "en" && <US className="mr-2 size-4" />}
            {languageText}
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="max-sm:max-w-48">
              <DropdownMenuItem
                onClick={() => {
                  setLanguage("fr" as Language);
                }}
                >
                <French className="mr-2 size-4" />
                Français
                {language === "fr" && <Check className="mr-2 size-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setLanguage("en" as Language);
                }}
                >
                <US className="mr-2 size-4" />
                English
                {language === "en" && <Check className="mr-2 size-4" />}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            queryClient.clear();
            logout();
          }}
        >
          <LogOutIcon className="mr-2 size-4" />
          {logoutText}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
