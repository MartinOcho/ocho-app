"use client";

import { SmilePlusIcon, Loader2, PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import QuickReaction from "./messages/QuickReaction";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";
import { cn } from "@/lib/utils";
import {
  QueryKey,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { MessageData, ReactionData, ReactionInfo } from "@/lib/types";
import kyInstance from "@/lib/ky";
import { useSession } from "@/app/(main)/SessionProvider";
import { useToast } from "./ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import UserAvatar from "./UserAvatar";
import { Skeleton } from "./ui/skeleton";
import { t } from "@/context/LanguageContext";

interface ReactionProps {
  message: MessageData;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
  open?: boolean;
  quickReaction?: boolean;
  size?: number;
  className?: string;
  position?: "top" | "bottom";
  isOwner?: boolean;
}

export default function Reaction({
  message,
  children,
  open = false,
  quickReaction = false,
  size = 24,
  className,
  position = "bottom",
  isOwner = false,
  onOpenChange = () => {},
}: ReactionProps) {
  const [showReaction, setShowReaction] = useState(open);
  const [showPicker, setShowPicker] = useState(false);
  const { user: loggedInUser } = useSession();
  const [reactionPosition, setReactionPosition] = useState<"top" | "bottom">(
    position,
  );

  const { reactions: reactionsText, addReaction, somethingWentWrong } = t();

  useEffect(() => {
    setReactionPosition(position);
    return () => setReactionPosition("bottom");
  }, [position, setReactionPosition]);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const hasUserReacted = message.reactions.some(
    ({ user }) => user.id === loggedInUser.id,
  );

  const initialState: ReactionInfo = {
    reactions: message._count.reactions,
    hasUserReacted,
    content: hasUserReacted
      ? message.reactions.find(
          (reaction) => reaction.user.id === loggedInUser.id,
        )?.content
      : undefined,
  };

  const messageId = message.id;

  const queryKey: QueryKey = ["message-reaction", messageId];

  const { data: reactionData } = useQuery({
    queryKey,
    queryFn: () =>
      kyInstance.get(`/api/message/${messageId}/reaction`).json<ReactionInfo>(),
    initialData: initialState,
    staleTime: Infinity,
  });
  const {
    data: allReactions,
    status: reactionsStatus,
    isPending: reactionLoading,
  } = useQuery({
    queryKey: ["message-reactions", messageId],
    queryFn: () =>
      kyInstance
        .get(`/api/message/${messageId}/reactions`)
        .json<ReactionData[]>(),
    staleTime: Infinity,
    refetchInterval: 10_000,
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (emoji: string) => {
      const isReactionRemoval = allReactions?.some(
        (reaction) =>
          reaction.user.id === loggedInUser.id && reaction.content === emoji,
      );

      return isReactionRemoval
        ? kyInstance.delete(`/api/message/${messageId}/reaction`)
        : kyInstance.post(`/api/message/${messageId}/reaction`, {
            json: { content: emoji.trim() },
          });
    },
    onMutate: async (emoji: string) => {
      await queryClient.cancelQueries({
        queryKey: ["message-reactions", messageId],
      });

      // Obtenir l'état précédent
      const previousReactions = queryClient.getQueryData<ReactionData[]>([
        "message-reactions",
        messageId,
      ]);

      if (!previousReactions) return { previousReactions };

      // Mise à jour optimiste
      const isReactionRemoval = previousReactions.some(
        (reaction) =>
          reaction.user.id === loggedInUser.id && reaction.content === emoji,
      );

      const updatedReactions = isReactionRemoval
        ? previousReactions.filter(
            (reaction) =>
              !(
                reaction.user.id === loggedInUser.id &&
                reaction.content === emoji
              ),
          )
        : [
            ...previousReactions,
            {
              id: `${messageId}-${loggedInUser.id}-${emoji}`, // Génération d'un ID fictif
              content: emoji,
              user: loggedInUser,
            },
          ];

      queryClient.setQueryData(
        ["message-reactions", messageId],
        updatedReactions,
      );

      return { previousReactions };
    },
    onError: (error, _, context) => {
      if (context?.previousReactions) {
        queryClient.setQueryData(
          ["message-reactions", messageId],
          context.previousReactions,
        );
      }
      toast({
        variant: "destructive",
        description: somethingWentWrong,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["message-reactions", messageId],
      });
    },
  });

  useEffect(() => {
    setShowReaction(open);
  }, [open, setShowReaction]);

  const toggleReaction = () => {
    setShowPicker(false);
    setShowReaction(!showReaction);
    onOpenChange(showReaction);
  };
  const closeReaction = () => {
    setShowReaction(false);
    setShowPicker(false);
    onOpenChange(false);
  };
  const togglePicker = () => {
    setShowPicker(!showPicker);
  };

  const onReact = (emoji: string) => {
    closeReaction();
    mutate(emoji.trim());
  };

  const reactions = allReactions || [];

  // Grouper et compter les réactions par contenu
  const groupedReactions = reactions.reduce<
    Record<
      string,
      {
        count: number;
        users: {
          id: string;
          username: string;
          avatarUrl: string | null;
          displayName: string;
        }[];
      }
    >
  >((acc, reaction) => {
    const { content, user } = reaction;
    if (!acc[content]) {
      acc[content] = { count: 0, users: [] };
    }
    acc[content].count++;
    acc[content].users.push(user);
    return acc;
  }, {});

  // Trier les groupes par ordre décroissant du nombre d'occurrences
  const sortedReactions = Object.entries(groupedReactions).sort((a, b) => {
    if (b[1].count === a[1].count) {
      // Comparaison alphabétique en cas d'égalité sur `count`
      return a[0].localeCompare(b[0]);
    }
    // Tri principal par `count`
    return b[1].count - a[1].count;
  });

  const MAX_VISIBLE_REACTIONS = 2; // Nombre maximum de réactions visibles dans les onglets principaux

  return (
    <>
      {!showReaction && (
        <span
          onClick={toggleReaction}
          className={cn(
            "h-fit w-fit cursor-pointer",
            className,
            "top-[calc(100%-4px)]",
            !!allReactions?.length &&
              !children &&
              "-bottom-[40%] flex items-center gap-1 p-1 px-2",
            reactionsStatus !== "success" && !children && "hidden",
          )}
          title={addReaction}
        >
          {children || !allReactions?.length ? (
            <SmilePlusIcon size={size} />
          ) : (
            sortedReactions
              .slice(0, MAX_VISIBLE_REACTIONS)
              .map(([content, { count }]) => (
                <span key={content} className="flex items-center text-xs">
                  {content}
                  <span className="text-muted-foreground">{count}</span>
                </span>
              ))
          )}
          {sortedReactions.length > MAX_VISIBLE_REACTIONS && (
            <span className="flex items-center rounded-lg bg-background px-1 text-xs font-bold text-muted-foreground">
              {sortedReactions.length - MAX_VISIBLE_REACTIONS}{" "}
              <PlusIcon size={12} />
            </span>
          )}
        </span>
      )}
      {(showReaction || showPicker) && (
        <div
          className={cn(
            "fixed inset-0 h-full w-full bg-black/5 max-sm:left-full",
            (showReaction || showPicker) && "z-40",
          )}
          onClick={closeReaction}
        ></div>
      )}
      <div
        className={cn(
          "absolute z-30 flex flex-col max-sm:bottom-0",
          isOwner ? "right-0" : "left-0",
          (showReaction || showPicker) && "z-50",
          reactionPosition === "top" ? "sm:top-0" : "sm:bottom-0",
        )}
      >
        {showPicker && (
          <div
            className={cn(
              "absolute z-50 h-fit w-fit bg-background max-sm:fixed max-sm:bottom-2 max-sm:left-full max-sm:flex max-sm:w-full max-sm:justify-center max-sm:bg-transparent",
              !isOwner ? "left-0" : "right-0",
              reactionPosition === "top" ? "sm:top-0" : "sm:bottom-0",
            )}
          >
            <div className="absolute flex h-full w-full items-center justify-center">
              <Loader2 className="animate-spin" />
            </div>
            <Picker
              onEmojiSelect={({ native }: { native: string }) =>
                onReact(native)
              }
              data={data}
            />
          </div>
        )}
        {showReaction &&
          (reactionsStatus === "success" &&
          (!allReactions?.length ||
            (!reactionData.hasUserReacted && quickReaction)) ? (
            <QuickReaction
              onReact={onReact}
              onPickerOpen={togglePicker}
              className={cn("z-10", showPicker && "invisible")}
            />
          ) : (
            <AllReactions
              reactions={allReactions || []}
              onPickerOpen={togglePicker}
              onReact={onReact}
              loading={reactionLoading}
              quickClassName={cn("z-10", showPicker && "invisible")}
              className={cn(
                reactionPosition === "top" ? "sm:top-0" : "sm:bottom-0",
              )}
            />
          ))}
      </div>
    </>
  );
}

interface AllReactionsProps {
  reactions: ReactionData[];
  onReact: (emoji: string) => void;
  onPickerOpen: () => void;
  className?: string;
  quickClassName?: string;
  loading: boolean;
  open?: boolean;
}

function AllReactions({
  reactions,
  className,
  quickClassName,
  onReact,
  loading,
  onPickerOpen,
  open = false,
}: AllReactionsProps) {
  const [showQuickReaction, setShowQuickReaction] = useState(open);
  const { user: loggedinUser } = useSession();
  const { reactions: reactionsText, tapToReact, you, add, all, more } = t();

  const MAX_VISIBLE_REACTIONS = 2; // Nombre maximum de réactions visibles dans les onglets principaux

  useEffect(() => {
    setShowQuickReaction(open);
    return () => {
      setShowQuickReaction(false);
    };
  }, [open]);

  const closeQuickReaction = () => setShowQuickReaction(false);
  const openQuickReaction = () => setShowQuickReaction(true);

  // Grouper et compter les réactions par contenu
  const groupedReactions = reactions.reduce<
    Record<
      string,
      {
        count: number;
        users: {
          id: string;
          username: string;
          avatarUrl: string | null;
          displayName: string;
        }[];
      }
    >
  >((acc, reaction) => {
    const { content, user } = reaction;
    if (!acc[content]) {
      acc[content] = { count: 0, users: [] };
    }
    acc[content].count++;
    acc[content].users.push(user);
    return acc;
  }, {});

  // Trier les groupes par ordre décroissant du nombre d'occurrences
  const sortedReactions = Object.entries(groupedReactions).sort((a, b) => {
    if (b[1].count === a[1].count) {
      return a[0].localeCompare(b[0]);
    }
    return b[1].count - a[1].count;
  });

  // Réactions visibles et restantes
  const visibleReactions = sortedReactions.slice(0, MAX_VISIBLE_REACTIONS);
  const remainingReactions = sortedReactions.slice(MAX_VISIBLE_REACTIONS);

  const userReaction = sortedReactions.find(([_, { users }]) =>
    users.some((user) => user.id === loggedinUser.id),
  );

  return showQuickReaction ? (
    <QuickReaction
      onReact={onReact}
      onPickerOpen={onPickerOpen}
      className={quickClassName}
    />
  ) : (
    <div
      className={cn(
        "reaction-open flex min-h-96 min-w-[95%] select-none flex-col rounded-sm bg-card p-3 max-sm:fixed max-sm:bottom-[2%] max-sm:left-[150%] max-sm:-translate-x-[50%] sm:min-h-80 sm:min-w-72",
        className,
      )}
    >
      <h3 className="text-lg font-semibold">{reactionsText}</h3>
      <Tabs
        defaultValue="all"
        className="relative flex h-full flex-1 flex-col gap-1"
      >
        {!loading && (
          <TabsContent value="you" className="flex-1">
            {userReaction ? (
              <ReactionUsers
                users={[
                  {
                    id: loggedinUser.id,
                    username: loggedinUser.username,
                    avatarUrl: loggedinUser.avatarUrl,
                    displayName: loggedinUser.displayName,
                  },
                ]}
                onReact={onReact}
                content={userReaction[0]}
              />
            ) : (
              <div className="h-full cursor-pointer overflow-y-auto">
                <div
                  className="flex w-full items-center gap-2"
                  onClick={openQuickReaction}
                >
                  <UserAvatar userId={loggedinUser.id} avatarUrl={loggedinUser.avatarUrl} size={32} />
                  <div className="flex flex-1 flex-col items-start justify-center">
                    <span>{loggedinUser.displayName} ({you})</span>
                    <span className={cn("text-muted-foreground", "text-xs")}>
                      {tapToReact}
                    </span>
                  </div>
                  <span className="text-xl">
                    <SmilePlusIcon />
                  </span>
                </div>
              </div>
            )}
          </TabsContent>
        )}
        <TabsContent value="all" className="flex-1">
          {loading && <ReactionSkeleton />}
          {visibleReactions.map(([content, { users }]) => (
            <div key={content}>
              <ReactionUsers
                users={users}
                onReact={onReact}
                content={content}
              />
            </div>
          ))}
          {remainingReactions.map(([content, { users }]) => (
            <div key={content}>
              <ReactionUsers
                users={users}
                onReact={onReact}
                content={content}
              />
            </div>
          ))}
        </TabsContent>
        {reactions.length > 1 &&
          visibleReactions.map(([content, { users }]) => (
            <TabsContent key={content} value={content} className="flex-1">
              <ReactionUsers
                users={users}
                onReact={onReact}
                content={content}
              />
            </TabsContent>
          ))}
        {!!remainingReactions.length && (
          <TabsContent value="more" className="flex-1">
            {remainingReactions.map(([content, { users }]) => (
              <div key={content}>
                <ReactionUsers
                  users={users}
                  onReact={onReact}
                  content={content}
                />
              </div>
            ))}
          </TabsContent>
        )}

        <TabsList className="bg-transparent shadow-none">
          {!loading && (
            <>
              <TabsTrigger value="you">
                <span className="text-xs">{userReaction ? you : add}</span>
              </TabsTrigger>
              <TabsTrigger value="all">
                <span className="text-xs">{all}</span>
              </TabsTrigger>
              {reactions.length > 1 &&
                visibleReactions.map(([content, { count }]) => (
                  <TabsTrigger key={content} value={content}>
                    <span className="text-xs">
                      {content}{" "}
                      <span className="text-muted-foreground">{count}</span>
                    </span>
                  </TabsTrigger>
                ))}
            </>
          )}
          {reactions.length > 1 && remainingReactions.length > 0 && (
            <TabsTrigger value="more">
              <span className="text-xs">{more}</span>
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>
    </div>
  );
}

interface ReactionUsersProps {
  users: {
    id: string;
    username: string;
    avatarUrl: string | null;
    displayName: string;
  }[];
  content: string;
  onReact: (emoji: string) => void;
}

function ReactionUsers({ users, content, onReact }: ReactionUsersProps) {
  const { user: loggedinUser } = useSession();
  const { tapToUnreact, you, appUser } = t();

  // Vérifier si des utilisateurs sont présents
  if (users.length > 0) {
    return (
      <>
        {users.map((user) => (
          <div
            key={user.id}
            className={cn(
              "flex w-full items-center gap-2",
              user.id === loggedinUser.id && "cursor-pointer",
            )}
            onClick={
              user.id === loggedinUser.id ? () => onReact(content) : undefined
            }
          >
            <UserAvatar userId={user.id} avatarUrl={user.avatarUrl} size={32} />
            <div className="flex flex-1 flex-col items-start justify-center">
              <span>
                {user.id === loggedinUser.id ? you : user.displayName || appUser}
              </span>
              <span
                className={cn(
                  "text-[0.75rem] text-muted-foreground",
                  user.id === loggedinUser.id && "text-xs",
                )}
              >
                {user.id === loggedinUser.id
                  ? tapToUnreact
                  : `@${user.username}`}
              </span>
            </div>
            <span className="text-xl">{content}</span>
          </div>
        ))}
      </>
    );
  }

  // Si aucun utilisateur, afficher "Aucune réaction"
  return (
    <div className="flex w-full items-center gap-2">
      <UserAvatar userId={loggedinUser.id} avatarUrl={loggedinUser.avatarUrl} size={32} />
      <div className="flex flex-1 flex-col items-start justify-center">
        <span>Aucune réaction</span>
        <span className="text-xs text-muted-foreground">
          Appuyez pour ajouter une réaction
        </span>
      </div>
    </div>
  );
}

function ReactionSkeleton() {
  return (
    <div className="w-full animate-pulse space-y-1">
      <div className="flex w-full flex-shrink-0 items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex flex-1 flex-col items-start justify-center gap-0.5">
          <Skeleton className="h-3 w-28 rounded" />
          <Skeleton className="h-2.5 w-24 rounded" />
        </div>
        <Skeleton className="h-6 w-6 rounded-full" />
      </div>
      <div className="flex w-full flex-shrink-0 items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex flex-1 flex-col items-start justify-center gap-0.5">
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="h-2.5 w-16 rounded" />
        </div>
        <Skeleton className="h-6 w-6 rounded-full" />
      </div>
      <div className="flex w-full flex-shrink-0 items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex flex-1 flex-col items-start justify-center gap-0.5">
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="h-2.5 w-16 rounded" />
        </div>
        <Skeleton className="h-6 w-6 rounded-full" />
      </div>
    </div>
  );
}
