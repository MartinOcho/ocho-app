import { LinkIt, LinkItUrl } from "react-linkify-it";
import React from "react";
import OchoLink from "@/components/ui/OchoLink";
import UserLinkWithTooltip from "./UserLinkWithTooltip";
import { cn } from "@/lib/utils";
import { AtSign } from "lucide-react";

interface LinkifyProps {
  children: React.ReactNode;
  className?: string;
  postId?: string;
  mentions?: Array<{ userId: string; username: string; displayName: string }>;
}

export default function Linkify({ children, className, mentions }: LinkifyProps) {
  return (
    <LinkifyMention mentions={mentions} className={className}>
      <LinkifyHashtag className={className}>
        <LinkifyUsername className={className}>
          <LinkifyUrl className={className}>{children}</LinkifyUrl>
        </LinkifyUsername>
      </LinkifyHashtag>
    </LinkifyMention>
  );
}

function LinkifyUrl({ children, className }: LinkifyProps) {
  return (
    <LinkItUrl className={cn("text-primary hover:underline", className)}>
      {children}
    </LinkItUrl>
  );
}

// Handle @[displayName](userId) format for message mentions
function LinkifyMention({ children, className, mentions }: LinkifyProps) {
  // Create a map of userId -> username for quick lookup
  const usernameMap = mentions?.reduce((acc, m) => {
    acc[m.userId] = m.username;
    return acc;
  }, {} as Record<string, string>) || {};

  return (
    <LinkIt
      regex={/@\[([^\]]+)\]\(([^)]+)\)/}
      component={(match, key) => {
        // match = "@[displayName](userId)"
        // Extract displayName and userId using regex
        const mentionMatch = match.match(/@\[([^\]]+)\]\(([^)]+)\)/);
        if (!mentionMatch) return <span key={key}>{match}</span>;

        const displayName = mentionMatch[1];
        const userId = mentionMatch[2];
        const username = usernameMap[userId];

        return (
          <span
            key={key}
            className={cn(
              "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 bg-cyan-500/10 text-cyan-500 hover:bg-cyan-500/20 dark:bg-primary/10 dark:text-primary dark:hover:bg-primary/20 transition-colors",
              className
            )}
            title={displayName}
          >
            <AtSign className="h-3 w-3 text-inherit text-[#ee6e05] dark:text-primary " />
            <UserLinkWithTooltip
              username={username}
              onFind={async (user) => {}}
              className="text-[#ee6e05] dark:text-primary font-semibold"
            >
              {displayName}
            </UserLinkWithTooltip>
          </span>
        );
      }}
    >
      {children}
    </LinkIt>
  );
}

function LinkifyUsername({ children, postId, className }: LinkifyProps) {
  return (
    <LinkIt
      regex={/(?<!https?:\/\/\S*)(?<!@\[)@([a-zA-Z0-9_-]+)(?!\])/}
      component={(match, key) => {
        return (
          <UserLinkWithTooltip
            key={key}
            username={match.slice(1)}
            postId={postId}
            onFind={async (user) => {}}
            className={className}
          >
            {match}
          </UserLinkWithTooltip>
        );
      }}
    >
      {children}
    </LinkIt>
  );
}

function LinkifyHashtag({ children, className }: LinkifyProps) {
  return (
    <LinkIt
      regex={/(?<!https?:\/\/\S*)#([a-zA-Z0-9_-]+)/}
      component={(match, key) => {
        return (
          <OchoLink
            key={key}
            href={`/hashtag/${match.slice(1)}`}
            className={cn(className)}
          >
            {match}
          </OchoLink>
        );
      }}
    >
      {children}
    </LinkIt>
  );
}
export function LinkifyEmoji({ children, className }: LinkifyProps) {
  return (
    <LinkIt
      regex={/[\p{Emoji}\p{Emoji_Presentation}]/gu}
      component={(match, key) => {
        return (
          <span key={key} className={cn("emoji", className)}>
            {match}
          </span>
        );
      }}
    >
      {children}
    </LinkIt>
  );
}