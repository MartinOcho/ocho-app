import { Button } from "@/components/ui/button";
import { t } from "@/context/LanguageContext";
import { MessageSquareIcon, MessageSquareMore } from "lucide-react";

interface ReplyButtonProps {
  onClick: () => void;
  replies: number;
}

export default function ReplyButton({ replies, onClick }: ReplyButtonProps) {
  const { toReply } = t();
  return (
    <Button
      title={toReply}
      onClick={onClick}
      className="flex items-center gap-2"
      variant="ghost"
    >
      {!!replies ? <MessageSquareMore /> : <MessageSquareIcon />}
      <span className="text-sm font-medium tabular-nums">{toReply}</span>
    </Button>
  );
}
