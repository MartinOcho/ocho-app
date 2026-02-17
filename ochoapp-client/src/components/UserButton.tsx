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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import kyInstance from "@/lib/ky";
import AccountSwitcher from "./AccountSwitcher";
import { Language, VocabularyKey, VocabularyObject } from "@/lib/vocabulary";
import { useLanguage, useTranslation } from "@/context/LanguageContext";
import US from "./flags/US";
import French from "./flags/French";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Button } from "./ui/button";
import LoadingButton from "./LoadingButton";
import { toast } from "./ui/use-toast";

interface UserButtonProps {
  className?: string;
}

export default function UserButton({ className }: UserButtonProps) {
  const { user } = useSession();
  const { t } = useTranslation();
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn("aspect-square flex-none rounded-full", className)}
          title={profile}
        >
          <UserAvatar
            userId={user.id}
            avatarUrl={user.avatarUrl}
            size={40}
            hideBadge={false}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel className="max-sm:max-w-36">
          {loggedIn} @{user.username}
        </DropdownMenuLabel>
        <AccountSwitcher currentUserId={user.id} />
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
          <DropdownMenuSubTrigger className="">
            {language === "fr" && <French className="mr-2 size-4" />}
            {language === "en" && <US className="mr-2 size-4" />}
            {languageText}{" "}
            {language !== "en" && (
              <span className="max-sm:hidden">(Language)</span>
            )}
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
        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="hover:bg-destructive/20">
          <LogoutDialog />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LogoutDialog({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  // create mutation to logout user
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      console.log(error);
      
    },
  });

  const { mutate, isPending } = logoutMutation;

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children ? (
          <span className={className}>{children}</span>
        ) : (
          <div
            className={cn(
              "flex items-center gap-2 text-destructive",
              className,
            )}
            title={t("logout")}
          >
            <LogOutIcon className="size-4" />
            {t("logout")}
          </div>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("logout")}</DialogTitle>
          <DialogDescription>{t("logoutDescription")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild disabled={isPending}>
            <Button variant="outline">{t("cancel")}</Button>
          </DialogClose>
            <LoadingButton
              variant="destructive"
              onClick={() => mutate()}
              loading={isPending}
            >
              {t("logout")}
            </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
