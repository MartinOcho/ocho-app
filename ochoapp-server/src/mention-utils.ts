import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface ParsedMention {
  displayName: string;
  userId: string;
}

/**
 * Parse mentions from message content
 * Format: @[DisplayName](userId)
 * Example: "@[John Doe](user123) and @[Jane Smith](user456)"
 */
export function parseMentions(content: string): ParsedMention[] {
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const mentions: ParsedMention[] = [];
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push({
      displayName: match[1],
      userId: match[2],
    });
  }

  // Remove duplicates (same userId)
  const uniqueMentions = Array.from(
    new Map(mentions.map((m) => [m.userId, m])).values()
  );

  return uniqueMentions;
}

/**
 * Validate mentions exist and are room members
 */
export async function validateMentions(
  mentions: ParsedMention[],
  roomId: string
): Promise<{ valid: ParsedMention[]; invalid: string[] }> {
  const valid: ParsedMention[] = [];
  const invalid: string[] = [];

  for (const mention of mentions) {
    try {
      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id: mention.userId },
      });

      if (!user) {
        invalid.push(mention.userId);
        continue;
      }

      // Check if user is member of the room
      const membership = await prisma.roomMember.findUnique({
        where: {
          roomId_userId: { roomId, userId: mention.userId },
        },
      });

      if (!membership || membership.type === "BANNED" || membership.leftAt) {
        invalid.push(mention.userId);
        continue;
      }

      valid.push(mention);
    } catch (error) {
      console.error(`Error validating mention ${mention.userId}:`, error);
      invalid.push(mention.userId);
    }
  }

  return { valid, invalid };
}

/**
 * Create MessageMention records for validated mentions
 */
export async function createMessageMentions(
  messageId: string,
  validMentions: ParsedMention[]
) {
  if (validMentions.length === 0) return [];

  try {
    const created = await Promise.all(
      validMentions.map((mention) =>
        prisma.messageMention.upsert({
          where: {
            messageId_mentionedId: {
              messageId,
              mentionedId: mention.userId,
            },
          },
          update: {},
          create: {
            messageId,
            mentionedId: mention.userId,
          },
        })
      )
    );

    return created;
  } catch (error) {
    console.error("Error creating MessageMention records:", error);
    return [];
  }
}

/**
 * Create system MENTION messages for mentioned users (except sender)
 * These are used for notifications and marking mentions
 */
export async function createMentionSystemMessages(
  messageId: string,
  roomId: string,
  senderId: string,
  validMentions: ParsedMention[]
) {
  // Filter out mentions where mentionedUser === sender
  const mentionsForNotification = validMentions.filter(
    (m) => m.userId !== senderId
  );

  if (mentionsForNotification.length === 0) return [];

  try {
    const created = await Promise.all(
      mentionsForNotification.map((mention) =>
        prisma.message.create({
          data: {
            type: "MENTION",
            content: "", // Empty content for system messages
            roomId,
            recipientId: mention.userId,
            senderId, // The person who made the mention
            // Link to original message (would need a relation)
          },
        })
      )
    );

    return created;
  } catch (error) {
    console.error("Error creating mention system messages:", error);
    return [];
  }
}
