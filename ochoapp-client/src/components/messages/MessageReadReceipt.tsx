import { CheckCheck } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import { ReadUser } from "@/lib/types";

interface MessageReadReceiptProps {
  reads: ReadUser[];
  senderId: string | null;
  currentUserId: string;
  isGroup: boolean;
  readByLabel: string;
}

export default function MessageReadReceipt({
  reads,
  senderId,
  currentUserId,
  isGroup,
  readByLabel,
}: MessageReadReceiptProps) {
  const readers = reads.filter(
    (reader) => reader.id !== senderId && reader.id !== currentUserId,
  );

  if (!readers.length) return null;

  if (!isGroup) {
    if (senderId !== currentUserId) return null;
    return (
      <span aria-label={readByLabel} title={readByLabel}>
        <CheckCheck className="text-primary h-3.5 w-3.5 flex-shrink-0" />
      </span>
    );
  }

  return (
    <span
      aria-label={`${readByLabel}: ${readers.map((reader) => reader.displayName).join(", ")}`}
      className="flex flex-shrink-0 items-center -space-x-1"
      title={`${readByLabel}: ${readers.map((reader) => reader.displayName).join(", ")}`}
    >
      {readers.slice(0, 3).map((reader) => (
        <UserAvatar
          key={reader.id}
          userId={reader.id}
          avatarUrl={reader.avatarUrl}
          size={14}
          className="border-background border"
        />
      ))}
      {readers.length > 3 && (
        <span className="border-background bg-muted text-muted-foreground flex h-[14px] w-[14px] items-center justify-center rounded-full border text-[7px] font-bold">
          +{readers.length - 3}
        </span>
      )}
    </span>
  );
}
