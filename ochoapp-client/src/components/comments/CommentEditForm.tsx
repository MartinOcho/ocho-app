"use client";

import { useState } from "react";
import { CommentData } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateCommentMutation } from "./mutations";
import { useTranslation } from "@/context/LanguageContext";

export default function CommentEditForm({
  comment,
  onCancel,
}: {
  comment: CommentData;
  onCancel: () => void;
}) {
  const [content, setContent] = useState(comment.content);
  const mutation = useUpdateCommentMutation();
  const { t } = useTranslation();

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate(
          { id: comment.id, content: content.trim() },
          { onSuccess: onCancel },
        );
      }}
    >
      <Textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        maxLength={3000}
        autoFocus
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button
          type="submit"
          disabled={!content.trim() || mutation.isPending}
        >
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
