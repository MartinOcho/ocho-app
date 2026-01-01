// components/posts/editors/PostEditor.tsx
"use client";

import UserAvatar from "@/components/UserAvatar";
import { useSession } from "@/app/(main)/SessionProvider";
import { useSubmitPostMutation } from "./mutations";
import LoadingButton from "@/components/LoadingButton";
import useMediaUpload, { Attachment } from "./useMediaUpload";
import { ClipboardEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ImageIcon, Loader2, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { useDropzone } from "@uploadthing/react";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/context/LanguageContext";
import { VocabularyObject } from "@/lib/vocabulary";

export default function PostEditor() {
  const [clear, setClear] = useState(false);
  const [input, setInput] = useState("");
  const [gradient, setGradient] = useState<string | null>(null);
  const [triggerResize, setTriggerResize] = useState(false);
  const { user } = useSession();
  const mutation = useSubmitPostMutation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    startUpload,
    attachments,
    isUploading,
    removeAttachment,
    reset: resetMediaUpload,
  } = useMediaUpload();

  const {
    wtsup,
    chooseBackground,
    removeBackground,
    post,
    fileMaxSizeReached,
  } = t();

  function uploadFiles(files: File[]) {
    startUpload(files, { fileMaxSizeReached } as VocabularyObject);
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: uploadFiles,
  });

  const { onClick, ...rootProps } = getRootProps();

  const maxGradientLength = 100;

  function onSubmit() {
    mutation.mutate(
      {
        content: input.trim(),
        mediaIds: attachments.map((a) => a.mediaId).filter(Boolean) as string[],
        gradient:
          gradient && input.trim().length <= maxGradientLength
            ? Number(gradient.split("-")[1])
            : undefined,
      },
      {
        onSuccess: () => {
          setGradient(null);
          setInput("");
          resetMediaUpload();
          setClear(true);
          setTimeout(() => setClear(false), 100);
        },
      },
    );
  }

  const gradients = [1, 2, 3, 4, 5].map((i) => `gradient-${i}`);

  const canShowGradient =
    input.length <= maxGradientLength && !!gradient && !attachments.length;

  function onPaste(e: ClipboardEvent) {
    const files = Array.from(e.clipboardData.items)
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile()) as File[];
    if (files.length > 0) {
      e.preventDefault();
      uploadFiles(files);
    }
  }

  const placeholder = wtsup.replace("[name]", user.displayName.split(" ")[0]);

  return (
    <div
      {...rootProps}
      className="flex flex-col gap-5 bg-card/50 p-5 shadow-sm max-sm:border-t-8 max-sm:border-solid max-sm:border-background sm:rounded-md sm:bg-card"
    >
      <div
        className={cn(
          "flex h-max gap-2 rounded-3xl border border-input bg-background p-1 transition-all duration-75",
          isDragActive
            ? "outline-dashed outline-primary"
            : "items-endring-primary ring-offset-background has-[textarea:focus-visible]:outline-none has-[textarea:focus-visible]:ring-2 has-[textarea:focus-visible]:ring-ring has-[textarea:focus-visible]:ring-offset-2",
          !gradient && "items-end",
        )}
        onPaste={onPaste}
      >
        <div className="flex flex-col justify-between">
          {!!canShowGradient && (
            <Button
              onClick={() => {
                setGradient(null);
                textareaRef.current?.focus();
                setTriggerResize((prev) => !prev);
              }}
              size="icon"
              className={`min-h-0 animate-scale border border-input bg-background text-foreground outline-none ring-primary ring-offset-background hover:ring-2`}
              title={removeBackground}
            >
              <XIcon size={20} />
            </Button>
          )}
          <UserAvatar userId={user.id} avatarUrl={user.avatarUrl} size={40} />
        </div>
        <div
          className={cn(
            "flex-1",
            canShowGradient &&
              `gadient-post ${gradient} flex items-center justify-center rounded-[1.4rem] rounded-s-md text-center transition-all ${input.length <= 70 ? "text-3xl max-sm:text-lg" : "text-xl max-sm:text-base"}`,
          )}
        >
          <Textarea
            ref={textareaRef}
            placeholder={placeholder}
            className={cn(
              "max-h-[15rem] min-h-10 w-full overflow-y-auto rounded-none border-none bg-transparent px-0 ring-offset-transparent placeholder:text-gray-500 focus-visible:ring-transparent",
              canShowGradient && "max-w-fit text-center",
            )}
            rows={1}
            value={input}
            onChange={({ target: { value } }) => setInput(value)}
            triggerResize={triggerResize}
          />
          <input {...getInputProps()} />
        </div>
      </div>
      {!!attachments.length && (
        <AttachmentPreviews
          attachments={attachments}
          removeAttachment={removeAttachment}
        />
      )}
      <div className="flex w-full flex-col items-center justify-end gap-3">
        {!isUploading &&
          !attachments.length &&
          input.trim().length <= maxGradientLength && (
            <div
              title={chooseBackground}
              className="flex w-full justify-end gap-2"
            >
              {gradients.map((gradient, index) => (
                <Button
                  key={index + 1}
                  onClick={() => {
                    setGradient((prev) =>
                      prev === gradient ? null : gradient,
                    );
                    textareaRef.current?.focus();
                    setTriggerResize((prev) => !prev);
                  }}
                  size="icon"
                  className={`gadient-post ${gradient} min-h-0 animate-scale bg-[hsl(var(--gradient-4-default))] text-[hsl(var(--gradient-4-foreground))] hover:bg-[hsl(var(--gradient-4-default))]`}
                >
                  {" "}
                </Button>
              ))}
            </div>
          )}
        <div className="flex w-full items-center justify-end gap-2">
          {isUploading && (
            <Loader2 className="size-5 animate-spin text-primary" />
          )}
          <AddAttachmentButton
            onFilesSelected={uploadFiles}
            disabled={isUploading || attachments.length >= 5}
            clear={clear}
          />
          <LoadingButton
            onClick={onSubmit}
            loading={mutation.isPending}
            disabled={(!input.trim() && !attachments.length) || isUploading}
            className="min-w-20"
          >
            {post}
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}

interface AddAttachmentButtonProps {
  onFilesSelected: (files: File[]) => void;
  disabled: boolean;
  clear: boolean;
}

function AddAttachmentButton({
  onFilesSelected,
  disabled,
  clear,
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
        variant="ghost"
        size="icon"
        className="text-primary hover:text-primary"
        disabled={disabled}
        onClick={() => fileInputRef.current?.click()}
      >
        <ImageIcon size={20} />
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
          className="absolute right-3 top-3 rounded-full bg-foreground p-1.5 text-background transition-colors hover:bg-foreground/60"
        >
          <XIcon size={20} />
        </button>
      )}
      {!!(isUploading && progress) && (
        <div className="absolute inset-0 h-full w-full select-none">
          <div
            className={`absolute left-0 top-0 flex h-full w-full items-center rounded bg-background/80 px-2 py-1 text-center text-xl`}
          ></div>
          <div className="absolute left-[50%] top-0 z-10 flex h-full w-full translate-x-[-50%] items-center justify-center rounded text-center text-[2rem] font-bold text-foreground">
            {progress}%
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 p-1">
        <p className="h-fit w-fit max-w-full select-none overflow-hidden text-ellipsis text-nowrap rounded-sm bg-muted/40 px-2 italic text-muted-foreground">
          {file.name}
        </p>
      </div>
    </div>
  );
}
