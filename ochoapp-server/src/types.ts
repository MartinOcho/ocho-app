import { MessageType, Prisma } from "@prisma/client";

export type PrivacyType =
  | "PROFILE_VISIBILITY"
  | "POST_VISIBILITY"
  | "MESSAGE_PRIVACY"
  | "ONLINE_STATUS_VISIBILITY";

export type PrivacyValue =
  | "PUBLIC"
  | "FOLLOWERS"
  | "PRIVATE"
  | "EVERYONE"
  | "NO_ONE";

export type MenuBarContextType = {
  isVisible: boolean;
  setIsVisible: (isVisible: boolean) => void;
};
export type NavigationType =
  | "home"
  | "explore"
  | "activity"
  | "messages"
  | "settings"
  | null;
export type NavigationContextType = {
  currentNavigation: NavigationType;
  setCurrentNavigation: (currentNavigation: NavigationType) => void;
};

export type SearchFilter = 
  | "posts"
  | "users"
  | "friend"
  | "followers"
  | "following"
  | "verified-users"
  | "unrelated-users";

export function getUserDataSelect(
  loggedInUserId: string,
  username: string | undefined = undefined,
) {
  return {
    id: true,
    username: true,
    displayName: true,
    avatarUrl: true,
    bio: true,
            createdAt: true,
            lastSeen: true,
            verified: {
      where: {
        user: {
          username,
        },
      },
      select: {
        type: true,
        expiresAt: true,
      },
    },
    followers: {
      where: {
        followerId: loggedInUserId,
      },
      select: {
        followerId: true,
      },
    },
    following: {
      where: {
        follower: {
          username,
        },
      },
      select: {
        followerId: true,
      },
    },
    _count: {
      select: {
        posts: true,
        followers: true,
      },
    },
  } satisfies Prisma.UserSelect;
}

export function getPostDataIncludes(
  loggedInUserId: string,
  username: string | undefined = undefined,
) {
  return {
    user: {
      select: getUserDataSelect(loggedInUserId, username),
    },
    attachments: true,
    likes: {
      where: {
        userId: loggedInUserId,
      },
      select: {
        userId: true,
      },
    },
    bookmarks: {
      where: {
        userId: loggedInUserId,
      },
      select: {
        userId: true,
      },
    },
    relevance: {
      where: {
        userId: loggedInUserId,
      },
      select: {
        relevanceScore: true,
      },
    },
    _count: {
      select: {
        likes: true,
        comments: true,
      },
    },
  } satisfies Prisma.PostInclude;
}

export type UserData = Prisma.UserGetPayload<{
  select: ReturnType<typeof getUserDataSelect>;
}>;

export function getMessageDataSelect() {
  return {
    type: true,
    content: true,
    sender: {
      select: {
        id: true,
        displayName: true,
        username: true,
        avatarUrl: true,
        bio: true,
        lastSeen: true,
      },
    },
    recipient: {
      select: {
        id: true,
        displayName: true,
        username: true,
        avatarUrl: true,
        bio: true,
        lastSeen: true,
      },
    },
    attachments: {
      select: {
        id: true,
        type: true,
        url: true,
        publicId: true,
        width: true,
        height: true,
        format: true,
        resourceType: true,
      },
    },
    mentions: {
      select: {
        mentionedId: true,
        mentionedUser: {
          select: {
            id: true,
            displayName: true,
            username: true,
          },
        },
      }
    },
    createdAt: true,
  } satisfies Prisma.MessageSelect;
}

export function getLastMsgInclude(){
  return {
    room: {
      include: getChatRoomDataInclude(),
    }
  } satisfies Prisma.MessageInclude
}

export type LastMsgData = Prisma.MessageGetPayload<{
  include: ReturnType<typeof getLastMsgInclude>;
}>;

export function getChatRoomDataInclude(
  userId: string | undefined = undefined,
) {
  return {
    members: {
      select: {
        userId: true,
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
            createdAt: true,
            lastSeen: true,
            verified: {
              where: {
                userId,
              },
              select: {
                type: true,
                expiresAt: true,
              },
            },
            followers: {
              select: {
                followerId: true,
              },
            },
            following: {
              select: {
                followerId: true,
              },
            },
            _count: {
              select: {
                posts: true,
                followers: true,
              },
            },
          },
        },
        type: true,
        joinedAt: true,
        leftAt: true,
        kickedAt: true,
      },
    },
    messages: {
      take: 1,
      select: getMessageDataSelect(),
      orderBy: { createdAt: "desc" },
    },
  } satisfies Prisma.RoomInclude;
}

export type RoomData = Prisma.RoomGetPayload<{
  include: ReturnType<typeof getChatRoomDataInclude>;
}>;

export interface RoomsSection {
  rooms: RoomData[];
  nextCursor: string | null;
}

export function getMessageDataInclude(loggedInUserId: string) {
  return {
    sender: {
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        lastSeen: true,
      },
    },
    recipient: {
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        lastSeen: true,
      },
    },
    _count: {
      select: {
        reactions: true,
      },
    },
    reactions: {
      select: {
        user: true,
        content: true,
      },
      where: {
        userId: loggedInUserId,
      },
    },
    attachments: {
      select: {
        id: true,
        type: true,
        url: true,
        publicId: true,
        width: true,
        height: true,
        format: true,
        resourceType: true,
      },
    },
    mentions: {
      select: {
        mentionedId: true,
        mentionedUser: {
          select: {
            id: true,
            displayName: true,
            username: true,
          },
        },
      },
    },
  } satisfies Prisma.MessageInclude;
}


export type MessageData = Prisma.MessageGetPayload<{
  include: ReturnType<typeof getMessageDataInclude>;
}>;

export interface MessagesSection {
  messages: MessageData[];
  nextCursor: string | null;
}

// --- TYPES POUR LES ÉVÉNEMENTS SOCKET (PARTAGÉS AVEC CLIENT) ---
export interface SocketReceiveMessageEvent {
  newMessage: MessageData;
  roomId: string;
  tempId?: string;
  newRoom?: RoomData;
}

export interface SocketTypingUpdateEvent {
  roomId: string;
  typingUsers: { id: string; displayName: string; avatarUrl: string }[];
}

export interface SocketMessageDeletedEvent {
  messageId: string;
  roomId: string;
}

export interface GalleryMedia {
  id: string;
  type: string;
  url: string;
  publicId: string | null;
  width: number | null;
  height: number | null;
  format: string | null;
  resourceType: string | null;
  messageId: string;
  senderUsername: string;
  senderAvatar: string | null;
  sentAt: Date;
}

export interface SocketGalleryUpdatedEvent {
  roomId: string;
  medias: GalleryMedia[];
}


export interface SocketSendMessageEvent {
  content: string;
  roomId: string;
  type: MessageType;
  tempId?: string;
  attachmentIds?: string[];
  recipientId?: string;
}

export interface SocketStartChatEvent {
  targetUserId: string;
  isGroup: boolean;
  name?: string;
  membersIds?: string[];
}

export interface SocketMarkMessageReadEvent {
  messageId: string;
  roomId: string;
}

export interface SocketMarkMessageDeliveredEvent {
  messageId: string;
  roomId: string;
}

export interface SocketAddReactionEvent {
  messageId: string;
  roomId: string;
  content: string;
}

export interface SocketRemoveReactionEvent {
  messageId: string;
  roomId: string;
}

export interface SocketDeleteMessageEvent {
  messageId: string;
  roomId: string;
}

export interface SocketGetRoomsEvent {
  cursor?: string | null;
}

export interface SocketCheckUserStatusEvent {
  userId: string;
}

export interface SocketCreateNotificationEvent {
  type: any;
  recipientId?: string;
  postId?: string;
  commentId?: string;
}

export interface SocketDeleteNotificationEvent {
  type: any;
  recipientId?: string;
  postId?: string;
  commentId?: string;
}

export type PostData = Prisma.PostGetPayload<{
  include: ReturnType<typeof getPostDataIncludes>;
}>;

export interface UsersPage {
  users: UserData[];
  nextCursor: string | null;
}

export interface PostsPage {
  posts: PostData[];
  nextCursor: string | null;
}
export interface SearchPage {
  posts: (PostData | UserData)[];
  nextCursor: string | null;
}
export interface UsersPage {
  users: UserData[];
  nextCursor: string | null;
}

export function getCommentDataIncludes(loggedInUserId: string) {
  return {
    user: {
      select: getUserDataSelect(loggedInUserId),
    },
    post: {
      select: {
        userId: true,
        user: {
          select: {
            id: true,
            avatarUrl: true,
          },
        },
      },
    },
    likes: true,
    firstLevelComment: {
      include: getFirstCommentDataIncludes(loggedInUserId),
    },
    comment: {
      include: getFirstCommentDataIncludes(loggedInUserId),
    },
    _count: {
      select: {
        likes: true,
        replies: true,
        firstLevelOf: true,
      },
    },
  } satisfies Prisma.CommentInclude;
}

export type CommentData = Prisma.CommentGetPayload<{
  include: ReturnType<typeof getCommentDataIncludes>;
}>;
export function getFirstCommentDataIncludes(loggedInUserId: string) {
  return {
    user: {
      select: getUserDataSelect(loggedInUserId),
    },
    likes: true,
    _count: {
      select: {
        likes: true,
        replies: true,
        firstLevelOf: true,
      },
    },
  } satisfies Prisma.CommentInclude;
}

export type FirstCommentData = Prisma.CommentGetPayload<{
  include: ReturnType<typeof getFirstCommentDataIncludes>;
}>;

export interface CommentsPage {
  comments: (CommentData & { isRepliedByAuthor: boolean })[] | CommentData[];
  previousCursor: string | null;
}
export interface RepliesPage {
  replies: CommentData[];
  previousCursor: string | null;
  count? : number;
}

export const notificationsInclude = {
  issuer: {
    select: {
      username: true,
      displayName: true,
      avatarUrl: true,
    },
  },
  post: {
    select: {
      content: true,
    },
  },
  comment: {
    select: {
      id: true,
      content: true,
    },
  },
} satisfies Prisma.NotificationInclude;

export type NotificationData = Prisma.NotificationGetPayload<{
  include: typeof notificationsInclude;
}>;

export interface NotificationsPage {
  notifications: NotificationData[];
  nextCursor: string | null;
}

export interface FollowerInfo {
  followers: number;
  isFollowedByUser: boolean;
  isFolowing: boolean;
  isFriend?: boolean;
}

export interface LikeInfo {
  likes: number;
  isLikedByUser: boolean;
  isLikedByAuthor?: boolean;
}

export interface ReactionData {
  user: {
    id: string;
    displayName: string;
    username: string;
    avatarUrl: string | null;
  };
  content: string;
}
export interface ReactionInfo {
  reactions: number;
  hasUserReacted: boolean;
  content?: string;
}
export interface ReadUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}
export interface ReadInfo {
  reads: ReadUser[];
}

export interface DeliveryInfo {
  deliveries: ReadUser[];
}

export interface BookmarkInfo {
  isBookmarkedByUser: boolean;
}

export interface NotificationCountInfo {
  unreadCount: number;
}

export type SaveMessageResponse = {
  newRoom?: RoomData;
  userId: string;
  createInfo?: MessageData;
};

export type LocalUpload = {
  url: string;
  name: string | null;
  appUrl: string;
  type: string | null;
  size: number;
  serverData: {
    avatarUrl?: string;
    mediaId?: string;
  };
};
