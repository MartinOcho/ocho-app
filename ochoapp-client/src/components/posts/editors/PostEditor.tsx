// components/posts/editors/PostEditor.tsx
"use client";

import UserAvatar from "@/components/UserAvatar";
import { useSession } from "@/app/(main)/SessionProvider";
import { useSubmitPostMutation, useUpdatePostMutation } from "./mutations";
import LoadingButton from "@/components/LoadingButton";
import useMediaUpload, { Attachment } from "./useMediaUpload";
import {
  ClipboardEvent,
  DragEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { ImageIcon, Loader2, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { Textarea } from "@/components/ui/textarea";
import { VocabularyObject } from "@/lib/vocabulary";
import { useTranslation } from "@/context/LanguageContext";
import { CommentPolicy, Visibility } from "@prisma/client";
import { PostData } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PostEditorProps {
  post?: PostData;
  onClose?: () => void;
  variant?: "default" | "dialog";
}

export default function PostEditor({
  post,
  onClose,
  variant = "default",
}: PostEditorProps) {
  const isDialog = variant === "dialog";
  const [clear, setClear] = useState(false);
  const [input, setInput] = useState(post?.content ?? "");
  const [selectedGradient, setSelectedGradient] = useState<string | null>(
    post?.gradient ? `gradient-${post.gradient}` : null,
  );
  const [visibility, setVisibility] = useState<Visibility>(
    post?.visibility ?? "PUBLIC",
  );
  const [commentPolicy, setCommentPolicy] = useState<CommentPolicy>(
    post?.commentPolicy ?? "EVERYONE",
  );
  const [triggerResize, setTriggerResize] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const { user } = useSession();
  const submitMutation = useSubmitPostMutation();
  const updateMutation = useUpdatePostMutation();
  const mutation = post ? updateMutation : submitMutation;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gradientEditorRef = useRef<HTMLDivElement>(null);
  const wasShowingGradient = useRef(false);
  const inputValueRef = useRef(input);
  inputValueRef.current = input;
  const {
    startUpload,
    attachments,
    isUploading,
    removeAttachment,
    reset: resetMediaUpload,
  } = useMediaUpload();

  const { t } = useTranslation();

  const {
    wtsup,
    chooseBackground,
    removeBackground,
    post: postText,
    save,
    postVisibility,
    everyone,
    followers,
    private: privateText,
    commentAccess,
    noOne,
    preservePostMedia,
    fileMaxSizeReached,
  } = t();

  function uploadFiles(files: File[]) {
    if (post) return;
    startUpload(files, { fileMaxSizeReached } as VocabularyObject);
  }

  const maxGradientLength = 100;

  function onSubmit() {
    if (post) {
      updateMutation.mutate(
        {
          id: post.id,
          content: input.trim(),
          gradient:
            selectedGradient && input.trim().length <= maxGradientLength
              ? Number(selectedGradient.split("-")[1])
              : null,
          visibility,
          commentPolicy,
        },
        { onSuccess: onClose },
      );
      return;
    }

    submitMutation.mutate(
      {
        content: input.trim(),
        mediaIds: attachments.map((a) => a.mediaId).filter(Boolean) as string[],
        gradient:
          selectedGradient && input.trim().length <= maxGradientLength
            ? Number(selectedGradient.split("-")[1])
            : undefined,
        visibility,
        commentPolicy,
      },
      {
        onSuccess: () => {
          setSelectedGradient(null);
          setVisibility("PUBLIC");
          setCommentPolicy("EVERYONE");
          setInput("");
          resetMediaUpload();
          setClear(true);
          setTimeout(() => setClear(false), 100);
          onClose?.();
        },
      },
    );
  }

  const gradients = [1, 2, 3, 4, 5].map((i) => `gradient-${i}`);

  const canShowGradient =
    input.length <= maxGradientLength &&
    !!selectedGradient &&
    !attachments.length &&
    !post?.attachments.length;

  useLayoutEffect(() => {
    if (canShowGradient && gradientEditorRef.current) {
      const editor = gradientEditorRef.current;
      editor.textContent = inputValueRef.current;
      editor.focus();
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
      wasShowingGradient.current = true;
    }
    if (!canShowGradient && wasShowingGradient.current) {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(
        inputValueRef.current.length,
        inputValueRef.current.length,
      );
      wasShowingGradient.current = false;
    }
  }, [canShowGradient]);

  function onPaste(e: ClipboardEvent) {
    const files = Array.from(e.clipboardData.items)
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile()) as File[];
    if (files.length > 0) {
      e.preventDefault();
      if (post) return;
      uploadFiles(files);
    }
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (post) return;
    setIsDragActive(true);
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (post) return;
    setIsDragActive(false);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragActive(false);
    if (post) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length) {
      uploadFiles(files);
    }
  }

  const placeholder = wtsup.replace("[name]", user.displayName.split(" ")[0]);

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "flex flex-col gap-5",
        isDialog
          ? "bg-background min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"
          : "bg-card/50 max-sm:border-background sm:bg-card p-5 shadow-sm max-sm:border-t-8 max-sm:border-solid sm:rounded-md",
      )}
    >
      {isDialog && (
        <div className="flex shrink-0 items-center gap-3">
          <UserAvatar userId={user.id} avatarUrl={user.avatarUrl} size={56} />
          <span className="text-lg font-semibold">{user.displayName}</span>
        </div>
      )}
      {isDialog &&
        !isUploading &&
        !attachments.length &&
        !post?.attachments.length &&
        input.trim().length <= maxGradientLength && (
          <div
            title={chooseBackground}
            className="flex w-full items-center gap-3 p-1"
          >
            {gradients.map((gradient, index) => {
              const isSelected = selectedGradient === gradient;
              return (
                <Button
                  key={gradient}
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`${chooseBackground} ${index + 1}`}
                  aria-pressed={isSelected}
                  onClick={() => {
                    setSelectedGradient((prev) =>
                      prev === gradient ? null : gradient,
                    );
                  }}
                  className={cn(
                    "border-background size-12 shrink-0 rounded-full border-2 p-0 shadow",
                    gradient,
                    isSelected && "ring-primary ring-2",
                  )}
                />
              );
            })}
          </div>
        )}
      <div
        className={cn(
          "flex h-max gap-2 transition-all duration-75",
          !isDialog && "border-input bg-background rounded-3xl border p-1",
          isDragActive
            ? "outline-primary outline-dashed"
            : !isDialog &&
                "items-endring-primary ring-offset-background has-[textarea:focus-visible]:ring-ring has-[textarea:focus-visible]:ring-2 has-[textarea:focus-visible]:ring-offset-2 has-[textarea:focus-visible]:outline-none",
          !selectedGradient && !isDialog && "items-end",
          isDialog && (canShowGradient ? "w-full" : "h-full min-h-40 flex-1"),
        )}
        onPaste={onPaste}
      >
        {!isDialog && (
          <div className="flex flex-col justify-between">
            {!!canShowGradient && (
              <Button
                onClick={() => {
                  setSelectedGradient(null);
                  textareaRef.current?.focus();
                  setTriggerResize((prev) => !prev);
                }}
                size="icon"
                className="animate-scale border-input bg-background text-foreground ring-primary ring-offset-background min-h-0 border outline-none hover:ring-2"
                title={removeBackground}
              >
                <XIcon size={20} />
              </Button>
            )}
            <UserAvatar userId={user.id} avatarUrl={user.avatarUrl} size={40} />
          </div>
        )}
        {canShowGradient ? (
          <div
            className={cn(
              "relative flex aspect-video items-center justify-center overflow-hidden rounded-[1.4rem] rounded-s-md text-center leading-tight",
              selectedGradient,
              input.length <= 70
                ? "text-3xl max-sm:text-lg"
                : "text-xl max-sm:text-base",
              isDialog ? "w-full" : "min-w-0 flex-1",
            )}
          >
            <div
              ref={gradientEditorRef}
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline="true"
              aria-label={placeholder}
              className="relative z-10 flex min-h-0 w-full flex-1 items-center justify-center overflow-y-auto rounded-[inherit] border-0 bg-transparent p-4 text-center leading-tight wrap-break-word whitespace-pre-wrap outline-none"
              onInput={(event) =>
                setInput(event.currentTarget.textContent ?? "")
              }
            />
            {!input && (
              <div
                aria-hidden="true"
                className="text-muted-foreground pointer-events-none absolute inset-0 flex items-center justify-center p-4 text-center"
              >
                {placeholder}
              </div>
            )}
          </div>
        ) : (
          <div
            className={cn(
              "max-w-full flex-1",
              isDialog && "flex min-h-0 flex-col",
            )}
          >
            <Textarea
              ref={textareaRef}
              placeholder={placeholder}
              className={cn(
                "w-full overflow-y-auto rounded-none border-none bg-transparent px-0 ring-offset-transparent placeholder:text-gray-500 focus-visible:ring-transparent",
                isDialog
                  ? "min-h-40 flex-1 resize-none text-xl sm:text-2xl"
                  : "max-h-[14rem] min-h-10",
              )}
              rows={1}
              value={input}
              onChange={({ target: { value } }) => setInput(value)}
              triggerResize={triggerResize}
            />
          </div>
        )}
      </div>
      {!!attachments.length && (
        <AttachmentPreviews
          attachments={attachments}
          removeAttachment={removeAttachment}
        />
      )}
      {post && post.attachments.length > 0 && (
        <p className="text-muted-foreground text-sm">{preservePostMedia}</p>
      )}
      <div className="flex w-full flex-col items-center justify-end gap-3">
        {!isDialog &&
          !isUploading &&
          !attachments.length &&
          !post?.attachments.length &&
          input.trim().length <= maxGradientLength && (
            <div
              title={chooseBackground}
              className="flex w-full justify-end gap-2"
            >
              {gradients.map((gradient, index) => (
                <Button
                  key={index + 1}
                  onClick={() => {
                    setSelectedGradient((prev) =>
                      prev === gradient ? null : gradient,
                    );
                    setTriggerResize((prev) => !prev);
                  }}
                  size="icon"
                  className={`gradient-post ${gradient} animate-scale min-h-0 bg-[hsl(var(--gradient-4-default))] text-[hsl(var(--gradient-4-foreground))] hover:bg-[hsl(var(--gradient-4-default))]`}
                >
                  {" "}
                </Button>
              ))}
            </div>
          )}
        <div
          className={cn(
            "flex w-full flex-col gap-3",
            !isDialog && "items-center justify-end",
          )}
        >
          {!post && (
            <AddAttachmentButton
              onFilesSelected={uploadFiles}
              disabled={isUploading || attachments.length >= 5}
              clear={clear}
              compact={isDialog}
              label={t("addMedia")}
            />
          )}
          <div className="grid w-full gap-3 sm:grid-cols-2">
            <PostSetting
              label={postVisibility}
              value={visibility}
              onValueChange={(value) => setVisibility(value as Visibility)}
              inDialog={isDialog}
              options={[
                { value: "PUBLIC", label: everyone },
                { value: "FOLLOWERS", label: followers },
                { value: "PRIVATE", label: privateText },
              ]}
            />
            <PostSetting
              label={commentAccess}
              value={commentPolicy}
              onValueChange={(value) =>
                setCommentPolicy(value as CommentPolicy)
              }
              inDialog={isDialog}
              options={[
                { value: "EVERYONE", label: everyone },
                { value: "FOLLOWERS", label: followers },
                { value: "NO_ONE", label: noOne },
              ]}
            />
          </div>
          <div className="flex w-full items-center justify-end gap-2">
            {isUploading && (
              <Loader2 className="text-primary size-5 animate-spin" />
            )}
            <LoadingButton
              onClick={onSubmit}
              loading={mutation.isPending}
              disabled={
                (!input.trim() &&
                  !attachments.length &&
                  !post?.attachments.length) ||
                isUploading
              }
              className={cn("min-w-20", isDialog && "w-full sm:w-auto")}
            >
              {post ? save : postText}
            </LoadingButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function PostSetting({
  label,
  value,
  onValueChange,
  options,
  inDialog = false,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  inDialog?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className={inDialog ? "z-100" : undefined}>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

interface AddAttachmentButtonProps {
  onFilesSelected: (files: File[]) => void;
  disabled: boolean;
  clear: boolean;
  compact?: boolean;
  label?: string;
}

function AddAttachmentButton({
  onFilesSelected,
  disabled,
  clear,
  compact = false,
  label,
}: AddAttachmentButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Clear the input on clear change
  useEffect(() => {
    if (clear) {
      fileInputRef.current!.value = "";
    }
  }, [clear]);

  return (
    <>
      <Button
        type="button"
        variant={compact ? "outline" : "ghost"}
        size={compact ? "default" : "icon"}
        className={cn(
          "text-primary hover:text-primary",
          compact && "h-10 w-fit gap-2 rounded-full px-4",
        )}
        disabled={disabled}
        onClick={() => fileInputRef.current?.click()}
      >
        <ImageIcon size={20} />
        {compact && label}
      </Button>
      <input
        type="file"
        accept="image/*, video/*"
        ref={fileInputRef}
        className="sr-only hidden"
        title="attachments input"
        multiple
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) {
            onFilesSelected(files);
            e.target.value = "";
          }
        }}
        maxLength={5}
      />
    </>
  );
}

interface AttachmentPreviewsProps {
  attachments: Attachment[];
  removeAttachment: (filename: string) => void;
}

function AttachmentPreviews({
  attachments,
  removeAttachment,
}: AttachmentPreviewsProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        attachments.length > 1 && "grid grid-cols-2",
      )}
    >
      {attachments.map((attachment) => (
        <AttachmentPreview
          key={attachment.file.name}
          attachment={attachment}
          onRemoveClick={() => removeAttachment(attachment.file.name)}
        />
      ))}
    </div>
  );
}

interface AttachmentPreviewProps {
  attachment: Attachment;
  onRemoveClick: () => void;
}

function AttachmentPreview({
  attachment: { file, mediaId, isUploading, progress },
  onRemoveClick,
}: AttachmentPreviewProps) {
  const src = URL.createObjectURL(file);

  return (
    <div className={cn("relative mx-auto size-fit overflow-hidden")}>
      {file.type.startsWith("image") ? (
        <Image
          src={src}
          alt="Attachment Preview"
          width={500}
          height={500}
          className="size-fit max-h-[30rem] rounded-2xl"
        />
      ) : (
        <video muted autoPlay className="size-fit max-h-[30rem] rounded-2xl">
          <source src={src} type={file.type} />
        </video>
      )}
      {!isUploading && (
        <button
          onClick={onRemoveClick}
          title="Retirer la pièce jointe"
          className="bg-foreground text-background hover:bg-foreground/60 absolute top-3 right-3 rounded-full p-1.5 transition-colors"
        >
          <XIcon size={20} />
        </button>
      )}
      {!!(isUploading && progress) && (
        <div className="absolute inset-0 h-full w-full select-none">
          <div
            className={`bg-background/80 absolute top-0 left-0 flex h-full w-full items-center rounded px-2 py-1 text-center text-xl`}
          ></div>
          <div className="text-foreground absolute top-0 left-[50%] z-10 flex h-full w-full translate-x-[-50%] items-center justify-center rounded text-center text-[2rem] font-bold">
            {progress}%
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 p-1">
        <p className="bg-muted/40 text-muted-foreground h-fit w-fit max-w-full overflow-hidden rounded-sm px-2 text-nowrap text-ellipsis italic select-none">
          {file.name}
        </p>
      </div>
    </div>
  );
}
