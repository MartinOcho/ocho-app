import { LinkIt, LinkItUrl } from "react-linkify-it";
import React from "react";
import OchoLink from "@/components/ui/OchoLink";
import UserLinkWithTooltip from "./UserLinkWithTooltip";
import { cn } from "@/lib/utils";

interface LinkifyProps {
  children: React.ReactNode;
  className?: string;
  postId?: string;
}

export default function Linkify({ children, className }: LinkifyProps) {
  return (
    <LinkifyHashtag className={className}>
      <LinkifyUsername className={className}>
        <LinkifyUrl className={className}>{children}</LinkifyUrl>
      </LinkifyUsername>
    </LinkifyHashtag>
  );
}

function LinkifyUrl({ children, className }: LinkifyProps) {
  return (
    <LinkItUrl className={cn("text-primary hover:underline", className)}>
      {children}
    </LinkItUrl>
  );
}

function LinkifyUsername({ children, postId, className }: LinkifyProps) {
  return (
    <LinkIt
      regex={/(?<!https?:\/\/\S*)@([a-zA-Z0-9_-]+)/}
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