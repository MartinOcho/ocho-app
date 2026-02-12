"use client";

import kyInstance from "@/lib/ky";
import { UserData } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import { HTTPError } from "ky";
import OchoLink from "@/components/ui/OchoLink";
import { PropsWithChildren, useEffect, useState } from "react";
import UserTooltip from "./UserTooltip";
import { useSession } from "@/app/(main)/SessionProvider";
import { cn } from "@/lib/utils";

interface UserLinkWithTooltipProps extends PropsWithChildren {
  username?: string;
  userId?: string;
  onFind?: (user: UserData)=> void;
  postId?: string;
  className?: string;
}

export default function UserLinkWithTooltip({
  children,
  username,
  userId,
  postId,
  onFind,
  className
}: UserLinkWithTooltipProps) {
  const [useDialog, setUseDialog] = useState(false);
  const { user } = useSession();

  // Determine query key and endpoint based on available ID
  const queryKey = userId ? ["user-data", userId] : ["user-data", username];
  const endpoint = userId 
    ? `/api/users/${userId}`
    : `/api/users/username/${username}`;

  useEffect(() => {
    const handleResize = () => {
      const isTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.matchMedia('(max-width: 768px)').matches;
      setUseDialog(isTouchScreen || isSmallScreen);
    };

    handleResize(); // Set initial state
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const { data } = useQuery({
    queryKey,
    queryFn: () =>
      kyInstance.get(endpoint, {
        searchParams: postId ? { postId } : undefined,
      }).json<UserData>(),
    retry(failureCount, error) {
      if (error instanceof HTTPError && error.response.status === 404) {
        return false;
      }
      return failureCount < 3;
    },
    staleTime: Infinity,
    enabled: !!(userId || username), // Only fetch if we have an ID
  });

  if (!data) {
    const profileUrl = userId 
      ? `/users/${userId}` 
      : `/users/${username}`;
    
    return (
      <OchoLink
        href={profileUrl}
        className={className}
      >
        {children}
      </OchoLink>
    );
  }
  if(onFind && (user.id !== data.id)) {
    onFind(data); 
  }
  return (
    <UserTooltip user={data}>
      {
        useDialog ? (<span className={cn("text-primary hover:underline", className)}>{children}</span>) : (
        <OchoLink
          href={`/users/${data.username}`}
          className={className}
        >
          {children}
        </OchoLink>
        )
      }
    </UserTooltip>
  );
}
