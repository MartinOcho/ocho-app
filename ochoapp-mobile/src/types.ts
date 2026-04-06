import { NotificationType, Prisma } from "@prisma/client";


export interface User {
  id: string;
  username: string;
  displayName: string;
  email?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  verified: VerifiedUser | null;
  createdAt?: number;
  lastSeen?: number;
  followersCount?: number;
  postsCount?: number;
  isFollowing?: boolean;
}

export interface VerifiedUser {
  verified: boolean;
  type: string | null;
  expiresAt: number | null;
}

export interface SignupRequest {
  username: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface UserSession {
  user?: User; // Détails de l'utilisateur si l'inscription réussit
  session?: Session;
}

export type DeviceType = 'ANDROID' | 'IOS' | 'WEB' | 'DESKTOP' | 'UNKNOWN';

export interface SignupResponse {
  success: boolean; // Contient une erreur si l'inscription échoue
  message?: string;
  name?: string;
  data?: UserSession; // Détails de la session si applicable
}

export interface LoginResponse {
  success: boolean; // Contient une erreur si la connexion échoue
  message?: string;
  name?: string;
  data?: UserSession;
}

export interface Session {
  id: string;
  userId: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  name?: string;
  error?: string;
  data?: T;
}

export interface Attachment {
  type: string;
  url: string;
}

export interface Post {
  id: string;
  author: User;
  content: string;
  createdAt: number;
  attachments: Attachment[];
  gradient?: number;
  likes: number;
  comments: number;
  isLiked: boolean;
  isBookmarked: boolean;
}

export interface Comment {
  id: string;
  author: User | null;
  content: string;
  createdAt: number;
  likes: number;
  isLiked: boolean;
  isLikedByAuthor: boolean;
  isRepliedByAuthor: boolean;
  postId: string;
  postAuthorId: string;
  replies: number;
}

export interface Reply {
  id: string;
  author: User | null;
  content: string;
  createdAt: number;
  likes: number;
  isLiked: boolean;
  isLikedByAuthor: boolean;
  commentId: string | null;
  commentAuthorId: string | null;
  commentAuthor: User | null;
  firstLevelCommentId: string | null;
  firstLevelCommentAuthorId: string | null;
  postId: string;
  postAuthorId: string;
  replies: number;
}

export type TrendingHashtagsResult = {
  hashtag: string;
  postsCount: string;
  likesCount: string;
};

export interface NotificationsPage {
    notifications: NotificationData[];
    cursor: string | null;
    hasMore: boolean;
}

export interface NotificationData {
    id: string;
    type: NotificationType;
    read: boolean;
    issuer: User;
    recipientId: string;
    post?: Post | null;
    postId?: string | null;
    comment?: Comment | null;
    createdAt: number;
}

export interface PostsPage {
  posts: Post[];
  nextCursor: string | null;
}
export interface PostsIdsPage {
  posts: string[];
  nextCursor: string | null;
}

export interface CommentsPage {
  comments: Comment[];
  nextCursor: string | null;
}
export interface RepliesPage {
  replies: Reply[];
  nextCursor: string | null;
}

export interface LikeResponse {
  isLiked: boolean;
  likes: number;
}


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

export interface UserSettings {
  user: {
    id: string;
    username: string;
    displayName: string;
    email: string | null;
    birthday: string | null;
    bio: string | null;
    avatarUrl: string | null;
    createdAt: string;
    lastUsernameChange: string | null;
  };
  privacy: Record<PrivacyType, PrivacyValue>;
}

export interface PrivacyUpdateRequest {
  type: PrivacyType;
  value: PrivacyValue;
}

export interface BirthdayUpdateRequest {
  birthday: string; // ISO date string
}

export interface UsernameUpdateRequest {
  username: string;
}

export interface AccountDeletionRequest {
  confirmation: string;
}


// Type pour les pièces jointes locales (avant upload)
export interface LocalAttachment {
  id: string;
  attachmentId?: string;
  fileName?: string;
  type: AttachmentType;
  previewUrl?: string;
  url?: string;
  isUploading: boolean;
}

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

// Types pour l'historique d'activité
export type ActivityType =
  | "POST_CREATED"
  | "POST_LIKED"
  | "POST_BOOKMARKED"
  | "COMMENT_CREATED"
  | "COMMENT_LIKED"
  | "ROOM_JOINED"
  | "ROOM_LEFT"
  | "ROOM_CREATED"
  | "SEARCH_PERFORMED";

export interface ActivityItem {
  id: string; // ID généré pour l'activité
  activityType: ActivityType;
  createdAt: number; // timestamp
  entityId: string; // ID de l'entité concernée (post, comment, etc.)
  entity?: Post | Comment | Message | Room | User | SearchHistory; // Données de l'entité
  metadata?: Record<string, any>; // Métadonnées supplémentaires
}

export interface ActivityHistoryResponse {
  activities: ActivityItem[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

export interface ActivityHistoryRequest {
  userId: string;
  limit?: number;
  cursor?: string;
  type?: ActivityType;
  startDate?: number;
  endDate?: number;
}

// Types pour les messages et rooms (si pas déjà définis)
export interface Message {
  id: string;
  type: string;
  content: string;
  sender: User;
  recipient: User;
  attachments: Attachment[];
  mentions: MessageMention[];
  createdAt: number;
}

export interface MessageMention {
  mentionedId: string;
  mentionedUser: User;
}

export interface Room {
  id: string;
  name?: string | null;
  isGroup?: boolean;
  createdAt: number;
  members?: RoomMember[];
}

export interface RoomMember {
  userId: string;
  joinedAt: number;
  role?: string;
  type?: string;
}

export interface SearchHistory {
  id: string;
  query: string;
  createdAt: number;
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
              select: {
                type: true,
                expiresAt: true,
              },
            },
            followers: {
              where: {
                followerId: userId,
              },
              select: {
                followerId: true,
              },
            },
            following: {
              where: {
                followerId: userId,
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

export type AttachmentType = "IMAGE" | "VIDEO" | "DOCUMENT";

export interface MessageAttachment {
  id: string;
  type: AttachmentType;
  url: string;
  publicId: string | null;
  width: number | null;
  height: number | null;
  format: string | null;
  resourceType: string | null;
}


export type MessageData = Prisma.MessageGetPayload<{
  include: ReturnType<typeof getMessageDataInclude>;
}>;

export interface MessagesSection {
  messages: MessageData[];
  nextCursor: string | null;
}

export type GalleryMedia = MessageAttachment & {
  messageId: string;
  senderUsername?: string;
  senderAvatar?: string | null;
  sentAt: Date;
};

export interface GalleryMediasSection {
  medias: GalleryMedia[];
  nextCursor: string | null;
}


export type PostData = Prisma.PostGetPayload<{
  include: ReturnType<typeof getPostDataIncludes>;
}>;

export interface UsersPage {
  users: UserData[];
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
  createdAt: Date;
}
export interface GroupedUser {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  reactedAt: Date; 
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

// ============================================================================
// TYPES POUR L'API DE RECHERCHE AMÉLIORÉE
// ============================================================================

export interface Hashtag {
  hashtag: string;
  postCount: number;
  likeCount: number;
}

export interface SearchHistoryItem {
  id: string;
  query: string;
  createdAt: number;
}

export interface SearchResults<T> {
  items: T[];
  hasMore: boolean;
  nextCursor?: string | null;
}

export interface GeneralSearchResponse {
  posts: SearchResults<Post>;
  users: SearchResults<User>;
  hashtags: SearchResults<Hashtag>;
}

export interface PostSearchResponse {
  activities: Array<{
    id: string;
    activityType: "POST";
    createdAt: number;
    entityId: string;
    entity: Post;
  }>;
  total: number;
  hasMore: boolean;
  nextCursor?: string | null;
}

export interface UserSearchResponse {
  activities: Array<{
    id: string;
    activityType: "USER";
    createdAt: number;
    entityId: string;
    entity: User;
  }>;
  total: number;
  hasMore: boolean;
  nextCursor?: string | null;
}

export interface HashtagSearchResponse {
  activities: Array<{
    id: string;
    activityType: "HASHTAG";
    createdAt: number;
    entityId: string;
    entity: Hashtag;
  }>;
  total: number;
  hasMore: boolean;
}

export interface SearchHistoryResponse {
  activities: Array<{
    id: string;
    activityType: "SEARCH_PERFORMED";
    createdAt: number;
    entityId: string;
    entity: SearchHistoryItem;
  }>;
  total: number;
  hasMore: boolean;
  nextCursor?: string | null;
}

export interface SaveSearchRequest {
  query: string;
}

export interface SaveSearchResponse {
  id: string;
  query: string;
  createdAt: number;
}

export type SearchType = "posts" | "users" | "hashtags";

export interface SearchFilters {
  type?: SearchType;
  limit?: number;
  cursor?: string;
  startDate?: number;
  endDate?: number;
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

// Room Footer States
export enum RoomFooterStateType {
  Loading = "LOADING",
  Normal = "NORMAL",
  Unspecified = "UNSPECIFIED",
  UserLeft = "USER_LEFT",
  UserKicked = "USER_KICKED",
  UserDeleted = "USER_DELETED",
  UserBanned = "USER_BANNED",
  PrivateProfile = "PRIVATE_PROFILE",
  GroupFull = "GROUP_FULL",
}

export type RoomFooterState =
  | { type: RoomFooterStateType.Loading }
  | { type: RoomFooterStateType.Normal }
  | { type: RoomFooterStateType.Unspecified }
  | { type: RoomFooterStateType.UserLeft }
  | { type: RoomFooterStateType.UserKicked }
  | { type: RoomFooterStateType.UserDeleted }
  | { type: RoomFooterStateType.UserBanned }
  | { type: RoomFooterStateType.PrivateProfile }
  | { type: RoomFooterStateType.GroupFull };
