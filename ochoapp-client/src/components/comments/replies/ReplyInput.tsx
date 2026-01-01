import { CommentData, FirstCommentData } from "@/lib/types";
import { useState } from "react";
import { t } from "@/context/LanguageContext";
import { useProgress } from "@/context/ProgressContext";
import { useSession } from "@/app/(main)/SessionProvider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import UserAvatar from "@/components/UserAvatar";
import { Loader2, SendIcon } from "lucide-react";
import { useSubmitReplyMutation } from "../mutations";
import { SubmitReply } from "../action";
import { cn } from "@/lib/utils";

interface CommentInput {
  comment: CommentData;
  onClose: ()=>void;
  profile?: boolean;
}

export default function ReplyInput({ comment, onClose, profile }: CommentInput) {
  const [input, setInput] = useState("");
  const { user } = useSession();
  const { toast } = useToast();

  const { invalidInput, replyTo } = t();

  const { startNavigation: navigate } = useProgress();

  const mutation = useSubmitReplyMutation(comment.id, comment.firstLevelCommentId || comment.id);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!input.trim() || input.trim().length > 1000) {
      toast({
        variant: "destructive",
        description: invalidInput,
      });
      return;
    }
    const firstLevelComment: FirstCommentData | null =
      comment.firstLevelComment;
    const reply: SubmitReply = {
      comments: { comment, firstLevelComment },
      content: input.trim(),
    };

    mutation.mutate(reply, {
      onSuccess: () => {
        setInput("");
      },
    });
  }
  function blured (){
    if(!input){
      onClose();
    }
  }

  return (
    <form
      className="flex w-full items-center p-2 max-sm:left-0 max-sm:z-20"
      onSubmit={onSubmit}
    >
      <div className={cn("flex w-full items-end gap-2 rounded-3xl border border-input bg-background p-1 ring-primary ring-offset-background transition-all duration-75 has-[textarea:focus-visible]:outline-none has-[textarea:focus-visible]:ring-2 has-[textarea:focus-visible]:ring-ring has-[textarea:focus-visible]:ring-offset-2", !profile && "ps-4")}>
        {profile && <UserAvatar userId={user.id} avatarUrl={user.avatarUrl} size={40} />}
        <Textarea
          placeholder={replyTo.replace(
            "[name]",
            comment.user.displayName.split(" ")[0],
          )}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoFocus
          className="max-h-40 flex-1 rounded-none border-none bg-transparent p-0 py-1.5 outline-none focus-visible:ring-transparent"
          rows={1}
          maxLength={1000}
          onBlur={blured}
        />
        <Button
          type="submit"
          size="icon"
          className="flex-shrink-0 rounded-full"
          disabled={!input.trim() || mutation.isPending}
        >
          {mutation.isPending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <SendIcon />
          )}
        </Button>
      </div>
    </form>
  );
}
