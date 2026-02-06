"use client";

import { Send } from "lucide-react";
import { useState, useRef } from "react";
import kyInstance from "@/lib/ky";
import { MessageAttachment, AttachmentType } from "@/lib/types";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { t } from "@/context/LanguageContext";

interface MessageFormComponentProps {
  expanded: boolean;
  onExpanded: (expanded: boolean) => void;
  onSubmit: (content: string) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
}

export function MessageFormComponent({
  expanded,
  onExpanded,
  onSubmit,
  onTypingStart,
  onTypingStop,
}: MessageFormComponentProps) {
  const [input, setInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [attachments, setAttachments] = useState<(
    MessageAttachment & { isUploading: boolean; fileName?: string; previewUrl?: string }
  )[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { typeMessage } = t();
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);

    // Trigger typing start
    onTypingStart?.();

    // Debounce typing stop
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onTypingStop?.();
    }, 3000);
  };

  const handleBtnClick = () => {
    if (!expanded) {
      onExpanded(true);
    } else if (input.trim()) {
      onSubmit(input);
      setInput("");
      onTypingStop?.();
    }
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const readFileAsDataURL = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Error reading file"));
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(file);
    });

  const uploadToCloudinary = async (file: File) => {
    // Read file as data URL (base64) and send to our server which uses cloudinary SDK
    const dataUrl = await readFileAsDataURL(file);
    const res = await kyInstance
      .post("/api/cloudinary/upload", { json: { file: dataUrl } })
      .json<{ success: boolean; result?: any; error?: string }>();

    if (!res || !res.success || !res.result) {
      throw new Error(res?.error || "Upload serveur échoué");
    }

    const r = res.result;
    const attachment: MessageAttachment = {
      id: undefined,
      type: (r.resource_type && String(r.resource_type).startsWith("video")) ? "VIDEO" : ((r.resource_type === "image" || (r.secure_url && /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(r.secure_url))) ? "IMAGE" : "DOCUMENT") as AttachmentType,
      url: r.secure_url || r.url || r.path,
      publicId: r.public_id,
      width: r.width || null,
      height: r.height || null,
      format: r.format || null,
      resourceType: r.resource_type || null,
    };

    return attachment;
  };

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const max = Math.min(files.length, 5);

    const newLocal = Array.from(files).slice(0, max).map((file) => {
      const type: AttachmentType = file.type.startsWith("image/") ? "IMAGE" : file.type.startsWith("video/") ? "VIDEO" : "DOCUMENT";
      return {
        id: undefined,
        type,
        url: "",
        publicId: undefined,
        width: null,
        height: null,
        format: null,
        resourceType: undefined,
        isUploading: true,
        fileName: file.name,
        previewUrl: URL.createObjectURL(file),
      } as MessageAttachment & { isUploading: boolean; fileName?: string; previewUrl?: string };
    });

    setAttachments((prev) => [...prev, ...newLocal]);

    // start uploads in background
    for (let i = 0; i < max; i++) {
      const file = files[i];
      const idx = i;

      try {
        const uploaded = await uploadToCloudinary(file);
        setAttachments((prev) => {
          const copy = [...prev];
          const target = copy.find((a) => a.fileName === file.name && a.isUploading) || copy[copy.length - max + idx];
          if (target) {
            target.url = uploaded.url;
            // @ts-expect-error - publicId is optional
            target.publicId = uploaded.publicId || uploaded.public_id || undefined;
            target.width = uploaded.width || null;
            target.height = uploaded.height || null;
            target.format = uploaded.format || null;
            // @ts-expect-error - resourceType is optional
            target.resourceType = uploaded.resourceType || uploaded.resource_type || null;
            target.isUploading = false;
          }
          return copy;
        });
      } catch (err) {
        console.error(err);
        setAttachments((prev) => prev.filter((a) => !(a.fileName === file.name && a.isUploading)));
        alert("Erreur lors de l'envoi du fichier");
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (input.trim()) {
        handleBtnClick();
      }
    }
  };

  const canSend = () => {
    if (isUploading) return false;
    if (input.trim().length > 0) return true;
    return attachments.length > 0 && attachments.some((a) => !a.isUploading && (a.url || a.previewUrl));
  };

  const handleSend = () => {
    handleBtnClick();
  };

  return (
    <div
      className={cn(
        "relative z-20 flex w-full items-end gap-1 rounded-3xl border border-input bg-background p-1 ring-primary ring-offset-background transition-[width] duration-75 has-[textarea:focus-visible]:outline-none has-[textarea:focus-visible]:ring-2 has-[textarea:focus-visible]:ring-ring has-[textarea:focus-visible]:ring-offset-2",
        expanded ? "" : "aspect-square w-fit rounded-full p-0",
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={handleFiles}
      />
      <button
        type="button"
        onClick={handleFileClick}
        title="Joindre un fichier"
        className="ml-2 mr-1 rounded-full p-2 text-muted-foreground hover:text-foreground"
        disabled={isUploading}
      >
        {isUploading ? "..." : "+"}
      </button>
      <div className="flex w-full flex-col gap-2">
        {attachments.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {attachments.map((a, i) => (
              <div key={i} className="relative w-24 h-24 rounded-md overflow-hidden border bg-muted">
                {a.previewUrl ? (
                  a.type === "VIDEO" ? (
                    <video src={a.previewUrl} className="w-full h-full object-cover" />
                  ) : a.type === "IMAGE" ? (
                    <img src={a.previewUrl} alt={a.publicId || "preview"} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center p-2 text-xs">{a.fileName}</div>
                  )
                ) : (
                  a.type === "VIDEO" ? (
                    <video src={a.url} className="w-full h-full object-cover" />
                  ) : a.type === "IMAGE" ? (
                    <img src={a.url} alt={a.publicId || "media"} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center p-2 text-xs">{a.fileName}</div>
                  )
                )}
                {a.isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">...</div>
                )}
              </div>
            ))}
          </div>
        )}
        <Textarea
        placeholder={typeMessage}
        className={cn(
          "max-h-[10rem] min-h-10 w-full resize-none overflow-y-auto rounded-none border-none bg-transparent px-4 py-2 pr-0.5 ring-offset-transparent transition-all duration-75 focus-visible:ring-transparent",
          expanded ? "relative w-full" : "invisible absolute w-0",
        )}
        rows={1}
        value={input}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
      </div>
      <Button
        size={!expanded ? "icon" : "default"}
        disabled={!canSend()}
        onClick={handleSend}
        className={cn(
          "rounded-full p-2",
          expanded
            ? ""
            : "h-[50px] w-[50px] rounded-full border-none outline-none",
        )}
        variant={expanded && input.trim() ? "default" : "outline"}
      >
        <Send />
      </Button>
    </div>
  );
}
