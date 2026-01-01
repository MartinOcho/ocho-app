import OchoLink from "@/components/ui/OchoLink";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import UserAvatar from "../UserAvatar";
import { RoomData, UserData } from "@/lib/types";
import Linkify from "../Linkify";
import { useSession } from "@/app/(main)/SessionProvider";

import { PlusCircle, UserCircle2 } from "lucide-react";
import React, { PropsWithChildren } from "react";
import AdminButton from "./AdminButton";
import { MemberType, VerifiedType } from "@prisma/client";
import RemoveMemberDialog from "./RemoveMemberDialog";
import BanDialog from "./BanDialog";
import RestoreMemberButton from "./RestoreMemberButton";
import Time from "../Time";
import MessageButton from "./MessageButton";
import { Button } from "../ui/button";
import { t } from "@/context/LanguageContext";
import Verified from "../Verified";
import { cn } from "@/lib/utils";

interface GroupUserPopover extends PropsWithChildren {
  user: UserData;
  type: MemberType;
  room: RoomData;
}

export default function GroupUserPopover({
  user,
  type,
  room,
  children,
}: GroupUserPopover) {
  const { user: loggedInUser } = useSession();
  const isMember = type !== "OLD" && type !== "BANNED";
  const member = room.members.find((member) => member.userId === user.id);

  const { groupAdmin, groupOwner, joined, leftSince, profile, you } = t();

  const joinedAt: Date | null = member?.joinedAt ?? null;
  const leftAt: Date | null = member?.leftAt ?? null;

  const members = room.members;

  const expiresAt = member?.user?.verified?.[0]?.expiresAt;
  const canExpire = !!(expiresAt ? new Date(expiresAt).getTime() : null);

  const expired = canExpire && expiresAt ? new Date() < expiresAt : false;

  const isVerified = !!member?.user?.verified?.[0] && !expired;
  const verifiedType: VerifiedType | undefined = isVerified
    ? member?.user?.verified?.[0]?.type
    : undefined;

  const verifiedCheck = isVerified ? (
    <Verified type={verifiedType} prompt={false} />
  ) : null;

  //  get the loggedin user values in members
  const loggedMember = members.find(
    (member) => member.userId === loggedInUser.id,
  );
  const isLoggedAdmin =
    loggedMember?.type === "ADMIN" || loggedMember?.type === "OWNER";
  const isBanned = type === "BANNED";
  const isOld = type === "OLD";

  return (
    <Popover>
      <PopoverTrigger asChild className="cursor-pointer">
        {children ?? (
          <li className="cursor-pointer px-4 py-2 active:bg-muted/30">
            <div className="flex items-center space-x-2">
              <UserAvatar userId={user?.id} avatarUrl={user?.avatarUrl} size={35} />
              <div className="flex-1 select-none">
                <p className={cn(isVerified && "flex items-center gap-1")}>
                  {user.id === loggedInUser?.id ? you : user?.displayName}
                  {verifiedCheck}
                </p>
                <p className="text-sm text-muted-foreground">
                  @{user?.username}
                </p>
              </div>
              {isMember && type !== "MEMBER" && (
                <span className="rounded bg-primary/30 p-[2px] text-xs">
                  {type === "ADMIN" ? groupAdmin : groupOwner}
                </span>
              )}
            </div>
          </li>
        )}
      </PopoverTrigger>
      <PopoverContent>
        <div className="flex flex-col gap-3">
          <div className="divide-y-2">
            <div
              className={`flex max-w-80 items-center gap-3 break-words px-1 py-2.5 md:min-w-52`}
            >
              <div className={`flex items-center justify-center gap-2`}>
                <OchoLink href={`/users/${user.username}`}>
                  <UserAvatar userId={user.id} avatarUrl={user.avatarUrl} size={70} />
                </OchoLink>
              </div>
              <OchoLink href={`/users/${user.username}`} className="text-inherit">
                <div
                  className={cn(
                    "text-lg font-semibold hover:underline",
                    isVerified && "flex items-center gap-1",
                  )}
                >
                  {user.displayName}
                  {verifiedCheck}
                </div>
                <div className="text-muted-foreground hover:underline">
                  @{user.username}
                </div>
              </OchoLink>
            </div>
            {user.bio && (
              <Linkify>
                <p className="line-clamp-4 whitespace-pre-line p-2">
                  {user.bio}
                </p>
              </Linkify>
            )}
            {joinedAt && (
              <p className="px-3 text-sm font-semibold text-muted-foreground">
                {joined} <Time time={joinedAt} long />
              </p>
            )}
            {joinedAt && leftAt && leftAt > joinedAt && (
              <p className="px-3 text-sm font-semibold text-muted-foreground">
                {leftSince} <Time time={leftAt} long />
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <OchoLink href={`/users/${user.username}`} className="text-inherit">
              <Button variant="secondary" className="flex w-full gap-1">
                <UserCircle2 /> {profile}
              </Button>
            </OchoLink>
            <MessageButton userId={user.id} />
          </div>
          {user.id !== loggedInUser.id &&
            loggedMember?.type != "MEMBER" &&
            isMember && (
              <>
                {isLoggedAdmin && type !== "OWNER" && (
                  <>
                    <AdminButton
                      type={type}
                      room={room}
                      member={user.id}
                    />
                    <RemoveMemberDialog memberId={user.id} room={room} />
                    <BanDialog memberId={user.id} room={room} />
                  </>
                )}
              </>
            )}
          {!isMember && isLoggedAdmin && (
            <>
              {isBanned && (
                <RestoreMemberButton memberId={user.id} room={room}>
                  <PlusCircle size={24} /> Retirer la suspention
                </RestoreMemberButton>
              )}
              {isOld && (
                <RestoreMemberButton memberId={user.id} room={room}>
                  <PlusCircle size={24} /> Reintegrer
                </RestoreMemberButton>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
