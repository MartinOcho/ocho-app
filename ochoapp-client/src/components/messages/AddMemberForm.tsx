"use client";

import { useState } from "react";
import kyInstance from "@/lib/ky";
import { Frown, Loader2, Meh, SearchIcon, XIcon } from "lucide-react";
import { RoomData, UserData, UsersPage } from "@/lib/types";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "../ui/input";
import UserAvatar from "../UserAvatar";
import { useAddMemberMutation } from "./mutations";
import LoadingButton from "../LoadingButton";
import { MemberType } from "@prisma/client";
import UsersList from "./UsersList";
import { Skeleton } from "../ui/skeleton";
import { t } from "@/context/LanguageContext";

interface AddMemberFormProps {
  onAdd: () => void;
  room: RoomData;
}

export default function AddMemberForm({ onAdd, room }: AddMemberFormProps) {
  const [query, setQuery] = useState<string>("");
  const [inputValue, setInputValue] = useState<string>("");
  const [selectedUsers, setSelectedUsers] = useState<UserData[]>([]);
  const queryClient = useQueryClient();

  const { add, availableUsers, noAvailableUser, dataError, searchUsers } = t();

  const mutation = useAddMemberMutation();

  const addUser = (user: UserData) => {
    if (!selectedUsers.find((selected) => selected.id === user.id)) {
      setSelectedUsers([...selectedUsers, user]);
    } else {
      removeUser(user);
    }
  };

  const removeUser = (user: UserData) => {
    setSelectedUsers(
      selectedUsers.filter((selected) => selected.id !== user.id),
    );
  };

  const {
    data,
    fetchNextPage,
    isFetching,
    hasNextPage,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ["group", "users", "search", query],
    queryFn: ({ pageParam }) =>
      kyInstance
        .get("/api/users/search", {
          searchParams: {
            q: query || "",
            roomId: room.id,
            ...(pageParam ? { cursor: pageParam } : {}),
          },
        })
        .json<UsersPage>(),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    gcTime: 0,
    staleTime: Infinity,
  });

  const userQuery = {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status,
  };

  const users = data?.pages?.flatMap((page) => page?.users) || [];

  const handleUserSelect = (user: UserData) => {
    if (selectedUsers.some((u) => u.id === user.id)) {
      setSelectedUsers(selectedUsers.filter((u) => u.id !== user.id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const handleSubmit = () => {
    mutation.mutate(
      {
        roomId: room.id,
        members: selectedUsers.map((member) => member.id),
      },
      {
        onSuccess: ({ newMembersList }) => {
          const newMembers = newMembersList
            .map((member) => ({
              user: {
                id: member.user?.id ?? "", // Fournit une valeur par défaut si null ou undefined
                username: member.user?.username ?? "",
                displayName: member.user?.displayName ?? "",
                avatarUrl: member.user?.avatarUrl ?? null,
                bio: member.user?.bio ?? null,
                createdAt: member.user?.createdAt ?? new Date(), // Fournit une valeur par défaut
                followers: member.user?.followers || [],
                _count: {
                  followers: member.user?._count?.followers ?? 0, // Valeur par défaut si undefined
                  posts: member.user?._count?.posts ?? 0, // Valeur par défaut si undefined
                },
              },
              userId: member.userId ?? "",
              type: "MEMBER" as MemberType, // Assurez-vous que "MEMBER" est bien une valeur valide pour MemberType
              joinedAt: new Date(),
            }))
            .filter(
              (member) => !selectedUsers.some((u) => u.id === member.userId),
            );

          setSelectedUsers([]);
          setQuery("");
          const queryKey = ["chat", room.id];

          queryClient.invalidateQueries({ queryKey });
          onAdd();
        },
      },
    );
  };

  return (
    <div className="w-full max-w-full space-y-4 overflow-hidden">
      {!!selectedUsers.length && (
        <>
          <div className="sticky top-0 flex w-full animate-scale gap-2 overflow-y-auto p-3 px-4">
            {selectedUsers.map((user, index) => (
              <div
                className="flex flex-shrink-0 flex-col items-center gap-1"
                key={index}
                onClick={() => removeUser(user)}
              >
                <div className="relative animate-scale">
                  <UserAvatar userId={user.id} avatarUrl={user.avatarUrl} size={48} />
                  <div className="absolute bottom-0 right-0 flex cursor-pointer items-center justify-center rounded-full bg-muted p-0.5 outline-2 outline-background">
                    <XIcon size={15} />
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {user.displayName.split(" ")[0]}
                </span>
              </div>
            ))}
          </div>
          <div className="sticky top-0 flex w-full animate-scale gap-2 px-2">
            <LoadingButton
              onClick={handleSubmit}
              loading={mutation.isPending}
              disabled={!selectedUsers.length}
              className="w-full rounded-lg"
            >
              {add} {!!selectedUsers.length && ` (${selectedUsers.length})`}
            </LoadingButton>
          </div>
        </>
      )}
      <div>
        <form
          className="relative p-1"
          onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            setQuery(inputValue);
          }}
        >
          <Input
            placeholder={searchUsers}
            className="rounded-3xl pe-10 ps-4"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <SearchIcon
            className="absolute right-3 top-1/2 size-5 -translate-y-1/2 transform text-muted-foreground hover:text-primary"
            onClick={() => setQuery(inputValue)}
          />
        </form>
      </div>

      <div className="space-y-2">
        {status === "error" && (
          <div className="my-8 flex w-full flex-col items-center gap-2 text-center text-muted-foreground">
            <Frown size={100} />
            <h2 className="text-xl">{dataError}</h2>
          </div>
        )}
        {status === "pending" && !!query && <UsersListSkeleton />}
        {status === "success" && !users.length && !hasNextPage && (
          <div className="my-8 flex w-full flex-col items-center gap-2 text-center text-muted-foreground">
            <Meh size={100} />
            <h2 className="text-xl">
              {noAvailableUser}
            </h2>
          </div>
        )}
        {status !== "success" && !query && <UsersListSkeleton />}
        <ul className="max-h-[300px] flex-1 justify-center overflow-y-auto">
          <UsersList
            query={userQuery}
            onSelect={addUser}
            title={availableUsers}
            selectedUsers={selectedUsers}
            canSelect={status === "success"}
          />
        </ul>
      </div>
    </div>
  );
}

function UsersListSkeleton() {
  return (
    <ul className="max-h-[60vh] flex-1 animate-pulse overflow-y-auto">
      <li className="cursor-pointer p-3 px-4">
        <div className="flex flex-shrink-0 items-center gap-2">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-3.5 w-[60%] min-w-20 rounded" />
            <Skeleton className="h-3 w-[80%] rounded" />
          </div>
        </div>
      </li>
      <li className="cursor-pointer p-3 px-4">
        <div className="flex flex-shrink-0 items-center gap-2">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-3.5 w-[60%] min-w-24 rounded" />
          </div>
        </div>
      </li>
      <li className="cursor-pointer p-3 px-4">
        <div className="flex flex-shrink-0 items-center gap-2">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-3.5 w-[60%] min-w-24 rounded" />
            <Skeleton className="h-3 w-[70%] rounded" />
          </div>
        </div>
      </li>
      <li className="cursor-pointer p-3 px-4">
        <div className="flex flex-shrink-0 items-center gap-2">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-3.5 w-[60%] min-w-24 rounded" />
            <Skeleton className="h-3 w-[50%] rounded" />
          </div>
        </div>
      </li>
    </ul>
  );
}
