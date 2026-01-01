import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import { Button } from "../ui/button";

interface QuickReactionProps {
  onReact: (reaction: string) => void;
  onPickerOpen: () => void;
  className?: string;
}

export default function QuickReaction({
  onReact,
  onPickerOpen,
  className,
}: QuickReactionProps) {
  const reactions = ["❤️", "😆", "😮", "😢", "😡", "👍"];

  return (
    <div
      className={cn(
        "flex flex-shrink-0 items-center gap-0.5 rounded-3xl bg-card/50 p-0.5",
        className,
      )}
    >
      {reactions.map((reaction, index) => (
        <Button
          variant="ghost"
          className="animate-scale rounded-full hover:bg-accent"
          size="icon"
          onClick={() => onReact(reaction)}
          key={index}
        >
          <span className="text-2xl">{reaction}</span>
        </Button>
      ))}
      <Button
        variant="ghost"
        className="animate-scale rounded-full hover:bg-accent"
        size="icon"
        onClick={onPickerOpen}
      >
        <Plus />
      </Button>
    </div>
  );
}
