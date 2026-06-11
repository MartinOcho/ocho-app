import { ReactNode } from "react";
import { UsersPage, UserData } from "@/lib/types";
import { Loader2, Check } from "lucide-react";
import UserAvatar from "../UserAvatar";
import { useToast } from "../ui/use-toast";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/context/LanguageContext";

type UsersQuery = {
  data: { pages: UsersPage[] } | undefined;
  isFetchingNextPage: boolean;
  isFetching: boolean;
  hasNextPage: boolean | undefined;
  fetchNextPage: () => void;
  status: string;
};

interface UsersListProps {
  query: UsersQuery;
  title: string;
  isGroup?: boolean;
  canSelect?: boolean;
  selectedUsers?: UserData[];
  onSelect: (user: UserData) => void;
  actions?: (user: UserData) => ReactNode;
}

export default function UsersList({
  query: { data, isFetching, isFetchingNextPage, hasNextPage, fetchNextPage },
  title,
  isGroup,
  selectedUsers = [],
  canSelect = true,
  onSelect,
  actions,
}: UsersListProps) {

  const { t } = useTranslation();

  const { toast } = useToast();
  const { cantSelectMoreUsers, showMore } = t();

  if (!data?.pages?.length) return null;

  return (
    <>
      {!!data?.pages[0].users.length && (
        <div className="w-full px-4 text-xs font-bold text-muted-foreground">
          {title}
        </div>
      )}
      {isFetching && !isFetchingNextPage && (
        <div className="flex w-full justify-center py-5">
          <Loader2 className="animate-spin" />
        </div>
      )}
      {data.pages.map((page, pageIndex) =>
        page.users.map((user) => (
          <div
            key={`${pageIndex}-${user.id}`}
            className={cn(
              "flex justify-between flex-wrap gap-3 w-full rounded-xl p-3 px-4 hover:bg-primary/5 active:bg-primary/5",
              !canSelect && "opacity-70",
            )}
          >
            <div
              className="flex flex-shrink-0 items-center gap-2"
              onClick={() => {
                if (!canSelect) {
                  toast({
                    description: cantSelectMoreUsers,
                  });
                  return;
                }
                onSelect(user);
              }}
            >
              <div className="relative flex-shrink-0">
                <UserAvatar userId={user.id} avatarUrl={user.avatarUrl} size={40} />
                {!!selectedUsers.find(
                  (selected) => selected.id === user.id,
                ) && (
                  <div className="absolute bottom-0 right-0 flex cursor-pointer items-center justify-center rounded-full bg-primary p-0.5 outline-2 outline-background">
                    <Check size={10} />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <p>{user.displayName}</p>
                {user.bio && (
                  <p className="line-clamp-2 w-full overflow-hidden text-ellipsis text-sm text-muted-foreground">
                    {user.bio}
                  </p>
                )}
              </div>
            </div>
            {actions && (
              <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                {actions(user)}
              </div>
            )}
          </div>
        )),
      )}
      {isFetchingNextPage && (
        <div className="flex w-full justify-center py-5">
          <Loader2 className="animate-spin" />
        </div>
      )}
      {hasNextPage && !isFetchingNextPage && (
        <div
          className="flex w-full cursor-pointer justify-center pb-2 text-primary hover:underline max-sm:underline"
          onClick={fetchNextPage}
        >
          {showMore}
        </div>
      )}
    </>
  );
}
