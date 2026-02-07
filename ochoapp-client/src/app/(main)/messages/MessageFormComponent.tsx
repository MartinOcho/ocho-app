"use client";

import { Send, X, Video, File as FileIcon, Loader2, Paperclip } from "lucide-react";
import { useState, useRef } from "react";
import kyInstance from "@/lib/ky";
import { AttachmentType } from "@/lib/types";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { t } from "@/context/LanguageContext";
import { CircleProgress } from "@/components/ui/CircleProgress";
import { useActiveRoom } from "@/context/ChatContext";

interface LocalAttachment {
  id: string; 
  attachmentId?: string; 
  fileName?: string;
  type: AttachmentType;
  previewUrl?: string;
  url?: string;
  isUploading: boolean;
}

interface MessageFormComponentProps {
  expanded: boolean;
  onExpanded: (expanded: boolean) => void;
  onSubmit: (content: string, attachmentIds?: string[], attachments?: LocalAttachment[]) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  canAttach?: boolean;
}

export function MessageFormComponent({
  expanded,
  onExpanded,
  onSubmit,
  onTypingStart,
  onTypingStop,
  canAttach = true,
}: MessageFormComponentProps) {
  const [input, setInput] = useState("");
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { isMediaFullscreen } = useActiveRoom(); 
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
    } else if (canSend()) {
      // Filter to only include uploaded attachments with IDs
      const uploadedAttachments = attachments.filter((a) => !a.isUploading && a.attachmentId);
      const uploadedAttachmentIds = uploadedAttachments.map((a) => a.attachmentId!);

      onSubmit(input, uploadedAttachmentIds.length > 0 ? uploadedAttachmentIds : undefined, uploadedAttachments.length > 0 ? uploadedAttachments : undefined);
      setInput("");
      setAttachments([]);
      onTypingStop?.();
    }
  };

  const handleFileClick = () => {
    if (!canAttach) return;
    const currentCount = attachments.filter((a) => !a.isUploading).length;
    if (currentCount >= 5) {
      alert("Limite de 5 médias par message atteinte");
      return;
    }
    fileInputRef.current?.click();
  };

  const readFileAsDataURL = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Error reading file"));
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(file);
    });

  const uploadToCloudinary = async (file: File, onProgress?: (progress: number) => void) => {
    // Read file as data URL (base64) and send to our server which uses cloudinary SDK
    const dataUrl = await readFileAsDataURL(file);
    
    // Simulate progress tracking (in a real scenario, you'd track actual upload)
    let simulatedProgress = 0;
    const progressInterval = setInterval(() => {
      simulatedProgress = Math.min(simulatedProgress + Math.random() * 30, 90);
      onProgress?.(simulatedProgress);
    }, 100);

    try {
      const serverUrl = (process.env.NEXT_PUBLIC_API_SERVER || process.env.NEXT_PUBLIC_SERVER_URL) || "http://localhost:5000";

      let res;
        // Envoi multipart/form-data vers le serveur Express qui fait le upload vers Cloudinary
        const form = new FormData();
        form.append("file", file);
        // essayer d'utiliser NEXT_PUBLIC_API_SERVER sinon NEXT_PUBLIC_CHAT_SERVER_URL
        const apiServer = (process.env.NEXT_PUBLIC_API_SERVER || process.env.NEXT_PUBLIC_CHAT_SERVER_URL || serverUrl).replace(/\/$/, "");
        res = await kyInstance.post(`${apiServer}/api/cloudinary/proxy-upload-multipart`, {
          body: form,
        }).json<{ success: boolean; attachmentId?: string; error?: string }>();
      

      clearInterval(progressInterval);
      onProgress?.(100);

      if (!res || !res.success || !res.attachmentId) {
        throw new Error(res?.error || "Erreur serveur lors de l'upload");
      }

      return res.attachmentId;
    } catch (error) {
      clearInterval(progressInterval);
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue lors de l'upload";
      throw new Error(`Erreur d'upload pour ${file.name}: ${errorMessage}`);
    }
  };

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Limite à 5 medias au total
    const maxTotal = 5;
    const currentCount = attachments.filter((a) => !a.isUploading).length;
    const maxNewFiles = Math.min(files.length, maxTotal - currentCount);

    if (maxNewFiles <= 0) {
      alert("Limite de 5 médias par message atteinte");
      return;
    }

    // Valider les fichiers
    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
    const ALLOWED_TYPES = /^(image|video)\//;

    const validFiles: File[] = [];
    const errors: string[] = [];

    for (let i = 0; i < maxNewFiles; i++) {
      const file = files[i];

      if (!ALLOWED_TYPES.test(file.type)) {
        errors.push(`${file.name}: Type de fichier non autorisé (images et vidéos seulement)`);
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        errors.push(`${file.name}: Fichier trop volumineux (${sizeMB}MB > 100MB)`);
        continue;
      }

      validFiles.push(file);
    }

    if (errors.length > 0) {
      alert(errors.join("\n"));
    }

    if (validFiles.length === 0) return;

    const newAttachments = validFiles.map((file) => {
      const type: AttachmentType = file.type.startsWith("image/") ? "IMAGE" : "VIDEO";
      return {
        id: `temp-${Date.now()}-${Math.random()}`,
        type,
        fileName: file.name,
        previewUrl: URL.createObjectURL(file),
        isUploading: true,
      } as LocalAttachment;
    });

    setAttachments((prev) => [...prev, ...newAttachments]);

    // start uploads in background
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const fileName = file.name;
      const localId = newAttachments[i].id;

      try {
        const attachmentId = await uploadToCloudinary(file, (progress) => {
          setUploadProgress((prev) => ({ ...prev, [fileName]: progress }));
        });

        setAttachments((prev) => {
          const copy = [...prev];
          const target = copy.find((a) => a.id === localId);
          if (target) {
            target.attachmentId = attachmentId;
            target.isUploading = false;
          }
          return copy;
        });
      } catch (err) {
        console.error(`Erreur upload ${fileName}:`, err);
        setAttachments((prev) => prev.filter((a) => a.id !== localId));
        
        const errorMsg = err instanceof Error ? err.message : "Erreur lors de l'envoi du fichier";
        alert(errorMsg);
      } finally {
        setUploadProgress((prev) => {
          const copy = { ...prev };
          delete copy[fileName];
          return copy;
        });
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (localId: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== localId));
    setUploadProgress((prev) => {
      const copy = { ...prev };
      const attachment = attachments.find((a) => a.id === localId);
      if (attachment?.fileName) {
        delete copy[attachment.fileName];
      }
      return copy;
    });
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
    const hasUploading = attachments.some((a) => a.isUploading);
    const hasContent = input.trim().length > 0;
    const hasUploadedAttachments = attachments.some((a) => !a.isUploading && a.attachmentId);
    
    return !hasUploading && (hasContent || hasUploadedAttachments);
  };

  const handleSend = () => {
    handleBtnClick();
  };

  return (
    <div
      className={cn(
        "relative flex z-20 w-full items-end gap-1 rounded-3xl border border-input bg-background p-1 ring-primary ring-offset-background transition-[width] duration-75 has-[textarea:focus-visible]:outline-none has-[textarea:focus-visible]:ring-2 has-[textarea:focus-visible]:ring-ring has-[textarea:focus-visible]:ring-offset-2",
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
      <Button
       type="button"
        size="icon"
        onClick={handleFileClick}
        className={cn(
          "p-2 size-10 max-w-10 max-h-10 min-h-10 min-w-10 rounded-full border-none outline-none",
          !canAttach && "opacity-50 cursor-not-allowed",
          attachments.some((a) => a.isUploading)
            ? "text-amber-500 hover:text-amber-600"
            : "text-muted-foreground hover:text-foreground",
            !expanded && "hidden",
        )}
        variant="outline"
        disabled={!canAttach || attachments.some((a) => a.isUploading) || attachments.filter((a) => !a.isUploading).length >= 5}
        title="Joindre un fichier"
      >
        {attachments.some((a) => a.isUploading) ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Paperclip className="h-5 w-5" />
        )}
      </Button>
      <div className={cn("flex w-full flex-col gap-2 border-r border-border", !expanded && "hidden")}>
        {attachments.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {attachments.map((a, i) => (
              <div
                key={i}
                className="group relative flex-shrink-0 overflow-hidden rounded-lg border border-border bg-muted transition-all hover:border-primary"
              >
                {/* Prévisualisation avec dimensions fixes */}
                <div className="relative w-24 h-24 flex items-center justify-center overflow-hidden bg-muted/80">
                  {a.previewUrl ? (
                    a.type === "VIDEO" ? (
                      <>
                        <video src={a.previewUrl} className="w-full h-full object-cover" />
                        <Video className="absolute h-4 w-4 text-white drop-shadow-lg opacity-70" />
                      </>
                    ) : a.type === "IMAGE" ? (
                      <img src={a.previewUrl} alt={a.fileName || "preview"} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-xs text-muted-foreground">
                        <FileIcon className="h-4 w-4" />
                        <span className="text-center truncate">{a.fileName?.slice(0, 8)}</span>
                      </div>
                    )
                  ) : (
                    a.type === "VIDEO" ? (
                      <>
                        <video src={a.url} className="w-full h-full object-cover" />
                        <Video className="absolute h-4 w-4 text-white drop-shadow-lg opacity-70" />
                      </>
                    ) : a.type === "IMAGE" ? (
                      <img src={a.url} alt={a.fileName || "media"} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-xs text-muted-foreground">
                        <FileIcon className="h-4 w-4" />
                        <span className="text-center truncate">{a.fileName?.slice(0, 8)}</span>
                      </div>
                    )
                  )}
                </div>

                {/* Overlay de progression */}
                {a.isUploading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 backdrop-blur-sm">
                    <CircleProgress
                      progress={uploadProgress[a.fileName || ""] ?? 0}
                      size={32}
                      strokeWidth={2}
                      className="text-white"
                    />
                  </div>
                )}

                {/* Bouton de supression */}
                <button
                  onClick={() => removeAttachment(a.id)}
                  className="absolute top-0.5 right-0.5 rounded-full bg-destructive/80 p-1 text-white transition-opacity hover:opacity-100"
                  type="button"
                  title="Supprimer"
                >
                  <X className="h-3 w-3" />
                </button>

                {/* Badge du type */}
                <div className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1.5 py-0.5 text-xs font-medium text-white">
                  {a.type === "IMAGE" ? "IMG" : a.type === "VIDEO" ? "VID" : "DOC"}
                </div>
              </div>
            ))}
          </div>
        )}
        <Textarea
          placeholder={t("typeMessage")}
          className={cn(
            "max-h-[10rem] min-h-10 w-full resize-none overflow-y-auto rounded-none border-none bg-transparent py-2 px-0.5 ring-offset-transparent transition-all duration-75 focus-visible:ring-transparent",
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
