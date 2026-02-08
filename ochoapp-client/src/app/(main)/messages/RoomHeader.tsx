import { RoomData, UserData, MessageData } from "@/lib/types";
import { useSession } from "../SessionProvider";
import GroupAvatar from "@/components/GroupAvatar";
import UserAvatar from "@/components/UserAvatar";
import { PropsWithChildren, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  PlusCircle,
  Settings2,
  ShieldBan,
  ShieldPlusIcon,
  UserCircle2,
  UserRoundPlus,
  X,
  Images,
  Info,
  Loader2,
} from "lucide-react";
import Linkify from "@/components/Linkify";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Time from "@/components/Time";
import OchoLink from "@/components/ui/OchoLink";
import AddMemberDialog from "@/components/messages/AddMemberDialog";
import { useActiveRoom } from "@/context/ChatContext";
import LeaveGroupDialog from "@/components/messages/LeaveGroupDialog";
import GroupChatSettingsDialog from "@/components/messages/GroupChatSettingsDialog";
import { cn } from "@/lib/utils";
import Verified from "@/components/Verified";
import { MemberType, VerifiedType } from "@prisma/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import kyInstance from "@/lib/ky";
import { Skeleton } from "@/components/ui/skeleton";
import LoadingButton from "@/components/LoadingButton";
import { useToast } from "@/components/ui/use-toast";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import BanDialog from "@/components/messages/BanDialog";
import MessageButton from "@/components/messages/MessageButton";
import RemoveMemberDialog from "@/components/messages/RemoveMemberDialog";
import { useSocket } from "@/components/providers/SocketProvider";
import MediaGallery from "@/components/messages/MediaGallery";
import { useGalleryQuery } from "@/hooks/useGalleryQuery";
import { useTranslation } from "@/context/LanguageContext";

interface ChatHeaderProps {
  roomId: string | null;
  isGroup: boolean;
  onDelete: () => void;
  initialRoom: RoomData;
}

export default function RoomHeader({
  roomId,
  isGroup,
  onDelete,
  initialRoom,
}: ChatHeaderProps) {
  const { t } = useTranslation();
  // Normaliser initialRoom pour garantir que members existe
  const normalizedInitialRoom: RoomData = useMemo(() => ({
    ...initialRoom,
    members: Array.isArray(initialRoom?.members) ? initialRoom.members : [],
  } as any), [initialRoom]);

  const [active, setActive] = useState(false);
  const [expandMembers, setExpandMembers] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [room, setRoom] = useState<RoomData>(normalizedInitialRoom);
  const [dialogFocus, setDialogFocus] = useState<"name" | "description" | null>(
    null,
  );

  const { isMediaFullscreen } = useActiveRoom();

  const [activeTab, setActiveTab] = useState<"info" | "media">("info");

  const {
    group,
    groupChat,
    appUser,
    you,
    online,
    viewProfile,
    created,
    member,
    members: membersText,
    namesAndName,
    namesAndOthers,
    settings,
    addAMember,
    addMembers,
    addDescription,
    noDescription,
    joined,
    seeAllMore,
    hide,
    memberSince,
    thisAccountDeleted,
    messageYourself,
  } = t();
  const queryClient = useQueryClient();
  const {checkUserStatus, onlineStatus} = useSocket();
  const queryKey = ["room", "head", roomId];
  const { data, status, error } = useQuery({
    queryKey,
    queryFn: () =>
      kyInstance.get(`/api/rooms/${roomId}/room-header`).json<RoomData>(),
    staleTime: Infinity,
  });

  const { user: loggedUser } = useSession();
  const { activeRoomId } = useActiveRoom();
  const { socket } = useSocket();

  useEffect(() => {
    setActive(false);
  }, [activeRoomId]);
  useEffect(() => {
    if (roomId) {
      // Clear the old room data
      setRoom(normalizedInitialRoom);
      // Revalidate the new room data
      queryClient.invalidateQueries({ queryKey });
    }
  }, [roomId, normalizedInitialRoom, queryClient, queryKey]);

  useEffect(() => {
    // Sync room data with API response when data arrives
    if (data) {
      const normalizedData = {
        ...data,
        members: Array.isArray(data?.members) ? data.members : [],
      } as any;
      setRoom(normalizedData);
    }
  }, [data]);

  useEffect(() => {
    // Sync room with initial data on component mount
    setRoom(normalizedInitialRoom);
  }, [normalizedInitialRoom]);
  if (!room) {
    if (status === "pending") {
      return (
        <div className="flex w-full flex-shrink-0 items-center gap-2 px-4 py-3 *:flex-shrink-0 max-sm:bg-card/50">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex w-full flex-col gap-2">
            <Skeleton className="h-3 w-40 max-w-full" />
            <Skeleton className="h-2 w-20 max-w-full" />
          </div>
        </div>
      );
    }
    if (status === "error") {
      return (
        <div className="flex w-full flex-shrink-0 items-center gap-2 px-4 py-3 *:flex-shrink-0">
          <UserAvatar userId={""} avatarUrl={null} size={40} />
          <div className="flex w-full flex-col gap-2">
            {isGroup ? group : "OchoApp User"}
          </div>
        </div>
      );
    }
  }

  const aMember = addAMember.match(/-(.*?)-/)?.[1] || "a member";
  const addAM = addAMember.replace(/-.*?-/, "");

  const isSaved = room.id === `saved-${loggedUser.id}`;

  const emptyUser: UserData = {
    id: "",
    username: "",
    displayName: "",
    avatarUrl: "",
    verified: [],
    bio: null,
    following: [],
    followers: [],
    lastSeen: new Date(0),
    createdAt: new Date(0),
    _count: {
      followers: 0,
      posts: 0,
    },
  };

  const otherUser =
    room?.members?.length === 1 && isSaved
      ? room?.members?.filter((member) => member.userId === loggedUser.id)?.[0]
          ?.user || emptyUser
      : room?.members?.filter((member) => member.userId !== loggedUser.id)?.[0]
          ?.user || emptyUser;

  const userId = otherUser?.id;
    const activeStatus = onlineStatus[userId || ""];
    !activeStatus && checkUserStatus(userId || "");

  const expiresAt = isSaved
    ? otherUser?.verified?.[0]?.expiresAt
    : otherUser?.verified?.[0]?.expiresAt;
  const canExpire = !!(expiresAt ? new Date(expiresAt).getTime() : null);

  const expired = canExpire && expiresAt ? new Date() < expiresAt : false;

  const isVerified =
    (isSaved ? !!otherUser?.verified[0] : !!otherUser?.verified[0]) &&
    !expired &&
    !room.isGroup;
  const verifiedType: VerifiedType | undefined = isVerified
    ? otherUser?.verified[0].type || "STANDARD"
    : undefined;

  const verifiedCheck = isVerified ? (
    <Verified type={verifiedType} prompt={active} />
  ) : null;

  const chatName = !!room?.name?.trim()
    ? room.name
    : (isSaved
        ? loggedUser.displayName + ` (${you})`
        : room?.members?.filter((member) => member.userId !== loggedUser.id)?.[0]
            ?.user?.displayName) || (room.isGroup ? groupChat : appUser);
  const weekAgo = new Date(
    new Date(room.createdAt).getTime() - 6 * 24 * 60 * 60 * 1000,
  );
  const isWeekAgo = weekAgo.getTime() >= new Date().getTime();

  const size = active ? 120 : 40;

  // Ensure room and members are properly initialized
  const safeMembers = Array.isArray(room?.members) ? room.members : [];
  const safeRoom = {
    ...room,
    members: safeMembers,
  };

  // Get loggedinMember from members
  const loggedinMember = safeMembers.find(
    (member) => member.userId === loggedUser.id,
  );
  // Get admins
  const admins = safeMembers.filter(
    (member) =>
      member.type === "ADMIN" && member.userId !== loggedinMember?.userId,
  );
  // Get owner
  const owner = [
    safeMembers.find((member) => member.type === "OWNER"),
  ].filter((member) => member?.userId !== loggedinMember?.userId);
  // Get members
  const members = safeMembers.filter(
    (member) => member.type !== "ADMIN",
  );

  // Remove logged user from owner admins and members
  const filteredMembers = members.filter(
    (member) => member.userId !== loggedUser.id,
  );

  // Remove admins and owner from filteredMembers
  const filteredMembers2 = filteredMembers.filter(
    (member) => member.type !== "ADMIN",
  );

  const filteredMembers3 = filteredMembers2.filter(
    (member) => member.type !== "OWNER",
  );

  const mergedMembers = [
    loggedinMember,
    ...owner,
    ...admins,
    ...filteredMembers3,
  ].filter(Boolean); // Filtrer les undefined
  const allMembers = (mergedMembers || [])
    .filter((member) => member?.type !== "OLD")
    .filter((member) => member?.type !== "BANNED");

  const oldMembers = (mergedMembers || []).filter((member) => member?.type === "OLD");
  const bannedMembers = (mergedMembers || []).filter(
    (member) => member?.type === "BANNED",
  );

  const firstPage = (allMembers || []).slice(0, 10);
  const lastPage = (allMembers || []).slice(10, (allMembers || []).length);

  const now = Date.now();

  const lastSeenTimeStamp = otherUser?.lastSeen
    ? new Date(new Date(otherUser.lastSeen).getTime() - 30_000).getTime()
    : null;

  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!socket) return;
    const handleUserOnline = (data: { userId: string }) => {
      setOnlineUsers((prev) =>
        prev.includes(data.userId) ? prev : [...prev, data.userId],
      );
    };
    const handleUserOffline = (data: { userId: string }) => {
      setOnlineUsers((prev) => prev.filter((id) => id !== data.userId));
    };
    socket.on("user_online", handleUserOnline);
    socket.on("user_offline", handleUserOffline);
    return () => {
      socket.off("user_online", handleUserOnline);
      socket.off("user_offline", handleUserOffline);
    };
  }, [socket]);

  const getStatusDisplay = () => {
    if (isSaved) return messageYourself;
    if (!otherUser?.id) return thisAccountDeleted;
    if (onlineUsers.includes(otherUser.id)) return online;
    if (activeStatus?.isOnline) {
      return online;
    }
    return `@${otherUser?.username || "ochoapp-user"}`;
  };

  return (
    <div
      className={cn(
        "z-50",
        active
          ? "absolute inset-0 h-full w-full overflow-y-auto bg-card max-sm:bg-background sm:rounded-e-3xl"
          : "relative flex-1 flex w-full items-center gap-2 px-4 py-3 max-sm:absolute max-sm:top-0 max-sm:left-0 max-sm:right-0 max-sm:bg-card/50",
      )}
    >
      <div
        className={
          "sticky inset-0 z-40 flex justify-between p-4 " +
          (!active ? "hidden" : "")
        }
      >
        <div
          className="cursor-pointer sm:pointer-events-none sm:opacity-0"
          onClick={() => setActive(false)}
        >
          <ChevronLeft size={35} />
        </div>
        <div
          className="cursor-pointer hover:text-red-500 max-sm:pointer-events-none max-sm:opacity-0"
          onClick={() => setActive(false)}
        >
          <X size={35} />
        </div>
      </div>
      <div
        className={`flex w-full flex-1 flex-col transition-all ${active ? "absolute inset-0 h-fit min-h-full bg-card max-sm:bg-background sm:rounded-e-3xl" : "relative"}`}
      >
        <div
          className={cn(
            `group/head flex flex-1 items-center gap-2 transition-all`,
            active ? "cursor-default flex-col p-3" : "cursor-pointer",
            isMediaFullscreen && "hidden",
          )}
          onClick={() => !active && setActive(true)}
        >
          {/* Mobile compact bar shown only on max-sm when not active */}
          <div className={cn("hidden max-sm:flex w-full items-center gap-2 px-0 py-0", !active && "max-sm:flex")}> 
            <div
              className="flex cursor-pointer bg-card/30 rounded-2xl hover:text-red-500 backdrop-blur-md p-2 border shadow-lg xl:w-fit items-center"
              title="Fermer la discussion items-center"
              onClick={(e) => {
                e.stopPropagation();
                setActive(false);
              }}
            >
              <ChevronLeft size={28} className="sm:hidden" />
              <div className="flex items-center bg-primary p-1 rounded-2xl px-2 text-xs ml-2">999+</div>
            </div>

            <div className="z-50 relative flex-1 flex cursor-pointer bg-card/30 hover:text-red-500 backdrop-blur-md p-2 border shadow-lg xl:w-fit rounded-[4rem]">
            {room.isGroup ? (
              <GroupAvatar size={size} className="transition-all *:transition-all" avatarUrl={room.groupAvatarUrl} />
            ) : (
              <UserAvatar userId={otherUser?.id || null} avatarUrl={otherUser?.avatarUrl} size={size} className="transition-all *:transition-all" />
            )}
            <div className="flex-1">
              {room.isGroup ? (
                <div>
                  <div className="text-xl font-bold">{chatName}</div>
                  <div className="text-sm text-muted-foreground">{`${allMembers?.length || 0} ${allMembers?.length === 1 ? member.toLowerCase() : membersText.toLowerCase()}`}</div>
                </div>
              ) : (
                <div>
                  <div className="text-xl font-bold">{chatName}</div>
                  <div className={cn("text-sm text-muted-foreground", (activeStatus?.isOnline || isSaved)  && "text-primary")}>
                    {getStatusDisplay()}
                  </div>
                </div>
              )}
            </div>
          </div>

            <div
              className="flex cursor-pointer hover:text-red-500"
              title="Fermer la discussion"
              onClick={(e) => {
                e.stopPropagation();
                setActive(false);
              }}
            >
              <X size={25} className="max-sm:hidden" />
            </div>
          </div>

          {/* Desktop / default layout (visible on sm and up) */}
          <div className="hidden sm:flex w-full items-center gap-2">
            {room.isGroup ? (
              <GroupAvatar size={size} className="transition-all *:transition-all" avatarUrl={room.groupAvatarUrl} />
            ) : (
              <UserAvatar userId={otherUser?.id || null} avatarUrl={otherUser?.avatarUrl} size={size} className="transition-all *:transition-all" />
            )}
            <div className="flex-1">
              {room.isGroup ? (
                <div>
                  <div className="text-xl font-bold">{chatName}</div>
                  <div className="text-sm text-muted-foreground">{`${allMembers?.length || 0} ${allMembers?.length === 1 ? member.toLowerCase() : membersText.toLowerCase()}`}</div>
                </div>
              ) : (
                <div>
                  <div className="text-xl font-bold">{chatName}</div>
                  <div className={cn("text-sm text-muted-foreground", (activeStatus?.isOnline || isSaved)  && "text-primary")}>
                    {getStatusDisplay()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        {active && (
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as any)}
            className="flex w-full flex-1 flex-col gap-3"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="info" className="flex items-center gap-2">
                <Info size={16} />
                <span>Infos</span>
              </TabsTrigger>
              <TabsTrigger value="media" className="flex items-center gap-2">
                <Images size={16} />
                <span>Médias</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="info"
              className="flex flex-1 flex-col gap-3 overflow-y-auto"
            >
              <div className="flex w-full flex-1 flex-col gap-3">
                {active && (
                  <div className="flex w-full justify-center">
                    {room.isGroup ? (
                      <div className="flex w-full justify-center gap-2">
                        {loggedinMember?.type !== "OLD" && (
                          <AddMemberDialog
                            room={room}
                            className="max-w-44 flex-1"
                          >
                            <Button
                              variant="outline"
                              className="flex h-fit w-full flex-col gap-2"
                            >
                              <UserRoundPlus size={35} />
                              <span>
                                {addAM}{" "}
                                <span className="max-sm:hidden">{aMember}</span>
                              </span>
                            </Button>
                          </AddMemberDialog>
                        )}
                        {(loggedinMember?.type === "ADMIN" ||
                          loggedinMember?.type === "OWNER") && (
                          <GroupChatSettingsDialog
                            room={room}
                            open={showDialog}
                            onOpenChange={(open) => {
                              setShowDialog(open);
                              open === false && setDialogFocus(null);
                            }}
                            className="max-w-44 flex-1"
                            focus={dialogFocus}
                          >
                            <Button
                              variant="outline"
                              className="flex h-fit w-full flex-col gap-2"
                            >
                              <Settings2 size={35} />
                              <span>{settings}</span>
                            </Button>
                          </GroupChatSettingsDialog>
                        )}
                      </div>
                    ) : (
                      <OchoLink
                        href={`/users/${otherUser?.username || "-"}`}
                        className="text-inherit"
                      >
                        <Button variant="outline" className="flex gap-1">
                          <UserCircle2 /> {viewProfile}
                        </Button>
                      </OchoLink>
                    )}
                  </div>
                )}
                <Linkify>
                  {room.isGroup ? (
                    <>
                      {room.description ? (
                        <p className="whitespace-pre-line break-words px-4 py-2 text-center">
                          {room.description}
                        </p>
                      ) : loggedinMember?.type === "ADMIN" ||
                        loggedinMember?.type === "OWNER" ? (
                        <div className="px-4 text-center">
                          <Button
                            variant="link"
                            className="py-0"
                            title={addDescription}
                            onClick={() => {
                              setDialogFocus("description");
                              setShowDialog(true);
                            }}
                          >
                            {addDescription}
                          </Button>
                        </div>
                      ) : (
                        <p className="px-4 text-center text-muted-foreground">
                          {noDescription}
                        </p>
                      )}
                    </>
                  ) : (
                    !!otherUser?.bio && (
                      <p className="whitespace-pre-line break-words px-4 py-2 text-center">
                        {otherUser.bio}
                      </p>
                    )
                  )}
                </Linkify>
                <div className="px-4 text-center text-sm text-muted-foreground">
                  {room.isGroup ? (
                    <span>
                      {created}{" "}
                      <Time time={room.createdAt} relative={!isWeekAgo} long />
                    </span>
                  ) : (
                    <span>
                      {otherUser?.id ? (
                        <>
                          {room.isGroup ? joined : memberSince}{" "}
                          {!!otherUser?.createdAt && (
                            <Time time={otherUser.createdAt} long />
                          )}
                        </>
                      ) : (
                        thisAccountDeleted
                      )}
                    </span>
                  )}
                </div>
                {room.isGroup && loggedinMember?.type !== "BANNED" && (
                  <ul className="flex w-full flex-col py-3">
                    <li className="select-none px-4 text-xs font-bold text-muted-foreground">{`${allMembers?.length || 0} ${allMembers?.length === 1 ? member.toLowerCase() : membersText.toLowerCase()}`}</li>
                    {loggedinMember?.type !== "OLD" && (
                      <AddMemberDialog room={room}>
                        <li className="cursor-pointer p-4 active:bg-muted/30">
                          <div className="flex items-center space-x-2">
                            <div
                              className={`relative flex aspect-square h-fit min-h-[35px] w-fit min-w-fit items-center justify-center overflow-hidden rounded-full bg-primary`}
                            >
                              <UserRoundPlus
                                className="absolute flex items-center justify-center text-primary-foreground"
                                size={35 - 16}
                              />
                            </div>
                            <p>{addMembers}</p>
                          </div>
                        </li>
                      </AddMemberDialog>
                    )}

                    {firstPage.map((member, key) => {
                      if (!member?.user) return null;
                      const user: UserData = member.user;
                      return (
                        <GroupUserPopover
                          key={key}
                          user={user}
                          type={member.type}
                          room={room}
                        />
                      );
                    })}

                    <>
                      {!!lastPage.length &&
                        expandMembers &&
                        lastPage.map((member, key) => {
                          if (!member?.user) return null;
                          const user: UserData = member.user;
                          return (
                            <GroupUserPopover
                              key={key}
                              user={user}
                              type={member.type}
                              room={room}
                            />
                          );
                        })}
                      {loggedinMember?.type !== "OLD" &&
                        !!oldMembers.length && (
                          <>
                            <li className="select-none px-4 text-xs font-bold text-muted-foreground">{`Anciens membres (${oldMembers.length})`}</li>
                            {oldMembers.map((member, key) => {
                              if (!member?.user) return null;
                              const user: UserData = member.user;
                              return (
                                <GroupUserPopover
                                  key={key}
                                  user={user}
                                  type={member.type}
                                  room={room}
                                />
                              );
                            })}
                          </>
                        )}
                      {(loggedinMember?.type === "ADMIN" ||
                        loggedinMember?.type === "OWNER") &&
                        !!bannedMembers.length && (
                          <>
                            <li className="select-none px-4 text-xs font-bold text-destructive">{`Membres suspendus (${bannedMembers.length})`}</li>
                            {bannedMembers.map((member, key) => {
                              if (!member?.user) return null;
                              const user: UserData = member.user;
                              return (
                                <GroupUserPopover
                                  key={key}
                                  user={user}
                                  type={member.type}
                                  room={room}
                                />
                              );
                            })}
                          </>
                        )}
                    </>

                    {!!lastPage.length && !expandMembers && (
                      <li
                        className="flex cursor-pointer px-4 py-2 text-primary hover:underline max-sm:justify-center"
                        onClick={() => setExpandMembers(true)}
                      >
                        {seeAllMore.replace("[len]", `${lastPage.length}`)}
                      </li>
                    )}

                    {expandMembers && (
                      <li
                        className="flex cursor-pointer px-4 py-2 text-primary hover:underline max-sm:justify-center"
                        onClick={() => setExpandMembers(false)}
                      >
                        {hide}
                      </li>
                    )}
                  </ul>
                )}
                {room.isGroup &&
                  loggedinMember?.type !== "OLD" &&
                  loggedinMember?.type !== "BANNED" && (
                    <ul className="flex w-full select-none flex-col py-3">
                      <li className="cursor-pointer p-4 text-red-500 active:bg-muted/30">
                        <LeaveGroupDialog room={room} onDelete={onDelete} />
                      </li>
                    </ul>
                  )}
              </div>
            </TabsContent>

            <TabsContent
              value="media"
              className="flex flex-1 flex-col gap-3 overflow-y-auto"
            >
              {roomId && <MediaGalleryContainer roomId={roomId} />}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

interface AdminButtonProps {
  member: string;
  type: MemberType;
  room: RoomData;
}

export function AdminButton({ member, type, room }: AdminButtonProps) {
  const [currentType, setCurrentType] = useState<string>(type);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  const { t } = useTranslation();

  const { user: loggedInUser } = useSession();
  const { makeGroupAdmin, dismissAsAdmin } = t();

  const roomId = room.id;

  const members = room?.members || [];

  //  get the loggedin user values in members
  const loggedMember = members.find(
    (member) => member.userId === loggedInUser.id,
  );

  const isAdmin = currentType === "ADMIN";
  const isLoggedAuthorized =
    type !== "OWNER" &&
    (loggedMember?.type === "ADMIN" || loggedMember?.type === "OWNER");

  function handleSubmit() {
    if (!socket) return;
    const initialType = currentType;
    setLoading(true);

    socket.emit("group_add_admin", { roomId, member }, (res: any) => {
      setLoading(false);
      if (res.success) {
        // Le serveur renvoie le nouveau membre mis à jour
        const newType = res.data.newRoomMember.type;
        if (newType !== initialType) {
          setCurrentType(newType);
          const queryKey = ["chat", roomId];
          queryClient.invalidateQueries({ queryKey });
        }
      } else {
        setCurrentType(initialType);
        console.error(res.error);
      }
    });
  }
  return (
    isLoggedAuthorized && (
      <LoadingButton
        loading={loading}
        variant={isAdmin ? "outline" : "default"}
        className={cn(
          "flex w-full justify-center gap-3",
          !isAdmin && "text-primary-foreground",
        )}
        onClick={handleSubmit}
      >
        {isAdmin ? (
          <>
            <ShieldBan size={24} className="fill-primary-foreground" />{" "}
            {dismissAsAdmin}
          </>
        ) : (
          <>
            <ShieldPlusIcon size={24} /> {makeGroupAdmin}
          </>
        )}
      </LoadingButton>
    )
  );
}

interface RestoreMemberButtonProps {
  memberId: string;
  room: RoomData;
  children: React.ReactNode;
}

export function RestoreMemberButton({
  memberId,
  room,
  children,
}: RestoreMemberButtonProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { groupRestoreSuccess } = t();
  const { socket } = useSocket();
  const [loading, setLoading] = useState(false);

  const roomId = room.id;
  const member = (room?.members || []).find((member) => member.userId === memberId);

  function handleSubmit() {
    if (!socket) return;
    setLoading(true);

    socket.emit("group_restore_member", { roomId, memberId }, (res: any) => {
      setLoading(false);
      if (res.success) {
        const queryKey = ["chat", roomId];
        queryClient.invalidateQueries({ queryKey });

        toast({
          description: groupRestoreSuccess
            .replace("[name]", member?.user?.displayName || "un utilisateur")
            .replace("[group]", room.name || "ce groupe"),
        });
      } else {
        console.error(res.error);
      }
    });
  }
  return (
    <LoadingButton
      loading={loading}
      className="flex w-full justify-center gap-3"
      onClick={handleSubmit}
    >
      {children}
    </LoadingButton>
  );
}

interface GroupUserPopover extends PropsWithChildren {
  user: UserData;
  type: MemberType;
  room: RoomData;
}

export function GroupUserPopover({
  user,
  type,
  room,
  children,
}: GroupUserPopover) {
  const { t } = useTranslation();
  const { user: loggedInUser } = useSession();
  const isMember = type !== "OLD" && type !== "BANNED";
  const member = (room?.members || []).find((member) => member.userId === user.id);

  const { groupAdmin, groupOwner, joined, leftSince, profile, you } = t();

  const joinedAt: Date | null = member?.joinedAt ?? null;
  const leftAt: Date | null = member?.leftAt ?? null;

  const members = room?.members || [];

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

  console.log("verifiedCheck:", verifiedCheck);

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
              <UserAvatar
                userId={user?.id}
                avatarUrl={user?.avatarUrl}
                size={35}
              />
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
      <PopoverContent className="z-50">
        <div className="flex flex-col gap-3">
          <div className="divide-y-2">
            <div
              className={`flex max-w-80 items-center gap-3 break-words px-1 py-2.5 md:min-w-52`}
            >
              <div className={`flex items-center justify-center gap-2`}>
                <OchoLink href={`/users/${user.username}`}>
                  <UserAvatar
                    userId={user.id}
                    avatarUrl={user.avatarUrl}
                    size={70}
                  />
                </OchoLink>
              </div>
              <OchoLink
                href={`/users/${user.username}`}
                className="text-inherit"
              >
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
                    <AdminButton type={type} room={room} member={user.id} />
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

// Composant helper pour charger les médias et afficher la galerie
export function MediaGalleryContainer({ roomId }: { roomId: string }) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useGalleryQuery({ roomId, enabled: !!roomId });

  const queryClient = useQueryClient();

  const allMedias = useMemo(
    () => data?.pages?.flatMap((page) => page?.medias ?? []) || [],
    [data]
  );

  return (
    <MediaGallery
      roomId={roomId}
      medias={allMedias}
      isLoading={isLoading}
      hasNextPage={hasNextPage ?? false}
      isFetchingNextPage={isFetchingNextPage}
      onLoadMore={() => fetchNextPage()}
      queryClient={queryClient}
    />
  );
}
