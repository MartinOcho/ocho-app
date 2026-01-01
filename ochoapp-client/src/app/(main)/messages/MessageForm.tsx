import { Button } from "@/components/ui/button";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import PlaceHolder from "@tiptap/extension-placeholder";
import { Loader2, Send } from "lucide-react";
import { useSubmitMessageMutation } from "@/components/messages/mutations";
import "./style.css";
import { useEffect, useState } from "react";
import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";

interface MessageFormProps {
  roomId: string;
  expanded: boolean;
  onExpanded: () => void;
}

export default function MessageForm({ roomId, expanded, onExpanded }: MessageFormProps) {
  const [input, setInput] = useState("");
  const queryClient = useQueryClient();
  const mutation = useSubmitMessageMutation();

  const {typeMessage} = t()

  function onSubmit() {
    mutation.mutate(
      {
        content: input,
        roomId,
      },
      {
        onSuccess: () => {
          setInput("")
          const queryKey = ["chat-rooms"];

          queryClient.invalidateQueries({ queryKey });
        },
      },
    );
  }

  function handleBtnClick() {
    expanded ? onSubmit() : onExpanded();
  }

  return (
        <div className={cn("relative flex w-full items-end gap-1 rounded-3xl border border-input bg-background p-1 ring-primary ring-offset-background transition-[width] duration-75 has-[textarea:focus-visible]:outline-none has-[textarea:focus-visible]:ring-2 has-[textarea:focus-visible]:ring-ring has-[textarea:focus-visible]:ring-offset-2", expanded ? "" : "aspect-square w-fit p-0 rounded-full")}>
          <Textarea
            placeholder={typeMessage}
            className={cn("max-h-[10rem] min-h-10 w-full overflow-y-auto rounded-none border-none bg-transparent px-4 py-2 pr-0.5 ring-offset-transparent focus-visible:ring-transparent transition-all duration-75", expanded ? "w-full relative" : "absolute w-0 invisible")}
            rows={1}
            value={input}
            onChange={({ target: { value } }) => setInput(value)}
          />
          <Button
            size={(!expanded ? "icon" : "default")}
            disabled={((expanded && (mutation.isPending || !input.trim())) || false)}
            onClick={handleBtnClick}
            className={cn("rounded-full p-2", expanded ? "": "outline-none border-none rounded-full w-[50px] h-[50px]")}
            variant={(expanded && input.trim()) ? "default": "outline"}
          >
            {mutation.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Send />
            )}
          </Button>
        </div>
    
  );
}
