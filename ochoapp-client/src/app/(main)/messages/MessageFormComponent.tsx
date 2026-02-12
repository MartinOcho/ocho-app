"use client";

import { Send, X, Video, File as FileIcon, Loader2, Paperclip, AtSign } from "lucide-react";
import { useState, useRef, useEffect } from "react";
// Nous n'utilisons plus kyInstance directement pour l'upload car fetch ne supporte pas l'upload progress
// import kyInstance from "@/lib/ky"; 
import { AttachmentType, MentionedUser, LocalAttachment } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CircleProgress } from "@/components/ui/CircleProgress";
import { useActiveRoom } from "@/context/ChatContext";
import { useTranslation } from "@/context/LanguageContext";
import MentionOverlay from "@/components/messages/MentionOverlay";
import { useMentions } from "@/hooks/useMentions";
import { useQuery } from "@tanstack/react-query";
import kyInstance from "@/lib/ky";
import { RoomData } from "@/lib/types";
import { EditableTextArea } from "@/components/messages/EditableTextArea";

interface MessageFormComponentProps {
  expanded: boolean;
  onExpanded: (expanded: boolean) => void;
  onSubmit: (content: string, attachmentIds?: string[], attachments?: LocalAttachment[], mentionedUsers?: MentionedUser[]) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  canAttach?: boolean;
  onContentChange?: (hasContent: boolean) => void;
  roomId?: string;
}

// Fonction utilitaire pour traduire les erreurs techniques en messages utilisateur
const getFriendlyErrorMessage = (error: unknown): string => {
  if (typeof error !== 'object' || error === null) return "Une erreur inattendue est survenue.";
  
  const msg = (error as Error).message || "";

  if (msg === "Upload cancelled") return "Upload annulé"; // Cas spécial pour ne pas alarmer
  if (msg.includes("Network Error") || msg.includes("Failed to fetch")) {
    return "Problème de connexion. Veuillez vérifier votre internet.";
  }
  if (msg.includes("413") || msg.includes("too large")) {
    return "Le fichier est trop volumineux pour être envoyé.";
  }
  if (msg.includes("401") || msg.includes("403")) {
    return "Session expirée. Veuillez rafraîchir la page.";
  }
  if (msg.includes("timeout")) {
    return "Le serveur met trop de temps à répondre.";
  }
  
  // Message par défaut générique pour ne pas effrayer l'utilisateur
  return "L'envoi du fichier a échoué. Veuillez réessayer.";
};

export function MessageFormComponent({
  expanded,
  onExpanded,
  onSubmit,
  onTypingStart,
  onTypingStop,
  canAttach = true,
  onContentChange,
  roomId,
}: MessageFormComponentProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  
  // Mentions
  const {
    mentionState,
    mentionedUsers,
    detectMentionStart,
    formatMention,
    addMentionedUser,
    clearMentionState,
  } = useMentions();
  
  // Ref pour stocker les fonctions d'annulation (abort) par ID de fichier local
  const abortControllersRef = useRef<Record<string, () => void>>({});
  
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editableTextAreaRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { isMediaFullscreen } = useActiveRoom(); 
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Fetch room data to get members for mention overlay
  const { data: roomData } = useQuery({
    queryKey: ["room", "data", roomId],
    queryFn: () =>
      kyInstance.get(`/api/rooms/${roomId}/chat-data`).json<RoomData>(),
    enabled: !!roomId,
    staleTime: Infinity,
  });

  // Track content changes for the parent
  const handleContentChange = () => {
    const hasContent = input.trim().length > 0 || attachments.length > 0;
    onContentChange?.(hasContent);
  };

  // Call onContentChange whenever input or attachments change
  useEffect(() => {
    handleContentChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, attachments]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const newCursorPos = e.currentTarget.selectionStart;
    
    setInput(newValue);
    setCursorPosition(newCursorPos);
    
    // Détect mention @
    detectMentionStart(newValue, newCursorPos, e.currentTarget);

    // Trigger typing start
    onTypingStart?.();

    // Debounce typing stop
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onTypingStop?.();
    }, 3000);
  };

  const handleInputChange = (newValue: string) => {
    setInput(newValue);

    // Get cursor position from contenteditable
    const selection = window.getSelection();
    let newCursorPos = newValue.length;

    if (selection && editableTextAreaRef.current) {
      const range = selection.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(editableTextAreaRef.current);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      newCursorPos = preCaretRange.toString().length;
    }

    setCursorPosition(newCursorPos);

    // Détect mention @
    detectMentionStart(newValue, newCursorPos, editableTextAreaRef.current || undefined);

    // Trigger typing start
    onTypingStart?.();

    // Debounce typing stop
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onTypingStop?.();
    }, 3000);
  };

  const handleSelectMention = (user: MentionedUser) => {
    // Find the @ symbol that triggered the mention
    const textBeforeCursor = input.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex === -1) {
      // Fallback: just use last @ in input
      const fallbackAtIndex = input.lastIndexOf("@");
      if (fallbackAtIndex === -1) return;
      
      const beforeAt = input.substring(0, fallbackAtIndex);
      const mentionText = `@[${user.displayName}](${user.username})`;
      const newInput = `${beforeAt}${mentionText} `;
      
      setInput(newInput);
      addMentionedUser(user);
      clearMentionState();

      const newCursorPos = beforeAt.length + mentionText.length + 1;
      setTimeout(() => {
        if (editableTextAreaRef.current) {
          editableTextAreaRef.current.focus();
          setCursorToPosition(editableTextAreaRef.current, newCursorPos);
        }
      }, 0);
      return;
    }

    // Build the new text with the mention
    const beforeAt = input.substring(0, lastAtIndex);
    const afterMention = input.substring(cursorPosition);
    const mentionText = `@[${user.displayName}](${user.username})`;
    const newInput = `${beforeAt}${mentionText} ${afterMention}`;
    
    // Set new input
    setInput(newInput);
    addMentionedUser(user);
    clearMentionState();

    // Calculate new cursor position (after the mention + space)
    const newCursorPos = beforeAt.length + mentionText.length + 1;
    
    setTimeout(() => {
      if (editableTextAreaRef.current) {
        editableTextAreaRef.current.focus();
        setCursorToPosition(editableTextAreaRef.current, newCursorPos);
      }
    }, 0);
  };

  // Helper function to set cursor position in contenteditable
  const setCursorToPosition = (element: HTMLElement, offset: number) => {
    const selection = window.getSelection();
    if (!selection) return;

    let currentOffset = 0;
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const nodeLength = node.textContent?.length ?? 0;
        if (currentOffset + nodeLength >= offset) {
          const range = document.createRange();
          range.setStart(node, Math.min(offset - currentOffset, nodeLength));
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          return;
        }
        currentOffset += nodeLength;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const nodeLength = (node as HTMLElement).textContent?.length ?? 0;
        if (currentOffset + nodeLength >= offset) {
          // Try to position in a text node inside
          const textNodes = getAllTextNodes(node as HTMLElement);
          for (const textNode of textNodes) {
            const textLength = textNode.textContent?.length ?? 0;
            if (currentOffset + textLength >= offset) {
              const range = document.createRange();
              range.setStart(textNode, Math.min(offset - currentOffset, textLength));
              range.collapse(true);
              selection.removeAllRanges();
              selection.addRange(range);
              return;
            }
            currentOffset += textLength;
          }
        }
        currentOffset += nodeLength;
      }
    }
  };

  // Helper function to get all text nodes
  const getAllTextNodes = (element: HTMLElement): Text[] => {
    const textNodes: Text[] = [];
    const walk = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walk.nextNode())) {
      textNodes.push(node as Text);
    }
    return textNodes;
  };

  const handleBtnClick = () => {
    if (!expanded) {
      onExpanded(true);
    } else if (canSend()) {
      // Filter to only include uploaded attachments with IDs
      const uploadedAttachments = attachments.filter((a) => !a.isUploading && a.attachmentId);
      const uploadedAttachmentIds = uploadedAttachments.map((a) => a.attachmentId!);

      onSubmit(
        input, 
        uploadedAttachmentIds.length > 0 ? uploadedAttachmentIds : undefined, 
        uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
        mentionedUsers.length > 0 ? mentionedUsers : undefined
      );
      setInput("");
      setAttachments([]);
      clearMentionState();
      onTypingStop?.();
    }
  };

  const handleFileClick = () => {
    if (!canAttach) return;
    const currentCount = attachments.filter((a) => !a.isUploading).length;
    if (currentCount >= 5) {
      alert(t("mediaLimitReached"));
      return;
    }
    fileInputRef.current?.click();
  };

  // Fonction d'upload native avec XMLHttpRequest pour le suivi réel de la progression
  // Ajout du paramètre onCancelSetup pour enregistrer la fonction d'annulation
  const uploadToCloudinary = async (
    file: File, 
    onProgress?: (progress: number) => void,
    onCancelSetup?: (cancelFn: () => void) => void
  ): Promise<string> => {    
    return new Promise((resolve, reject) => {
      const serverUrl = (process.env.NEXT_PUBLIC_API_SERVER || process.env.NEXT_PUBLIC_SERVER_URL) || "http://localhost:5000";
      const apiServer = (process.env.NEXT_PUBLIC_API_SERVER || process.env.NEXT_PUBLIC_CHAT_SERVER_URL || serverUrl).replace(/\/$/, "");
      const uploadUrl = `${apiServer}/api/cloudinary/proxy-upload-multipart`;

      const xhr = new XMLHttpRequest();
      const form = new FormData();
      form.append("file", file);

      // Enregistrement de la fonction d'annulation pour l'extérieur
      if (onCancelSetup) {
        onCancelSetup(() => {
          xhr.abort();
        });
      }

      // IMPORTANT: Pour tracker l'upload réel
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          // On s'assure de ne pas dépasser 99% tant que le serveur n'a pas confirmé
          onProgress?.(Math.min(percentComplete, 99));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const res = JSON.parse(xhr.responseText);
            if (res.success && res.attachmentId) {
              onProgress?.(100);
              resolve(res.attachmentId);
            } else {
              reject(new Error(res.error || "Erreur serveur lors de l'upload"));
            }
          } catch (e) {
            reject(new Error("Réponse serveur invalide"));
          }
        } else {
          reject(new Error(`Erreur HTTP: ${xhr.status}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error("Network Error"));
      };

      xhr.onabort = () => {
        reject(new Error("Upload cancelled"));
      };

      // Si votre API nécessite des cookies (session), décommentez ceci :
      xhr.withCredentials = true;

      xhr.open("POST", uploadUrl);
      xhr.send(form);
    });
  };

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Limite à 5 medias au total
    const maxTotal = 5;
    const currentCount = attachments.filter((a) => !a.isUploading).length;
    const maxNewFiles = Math.min(files.length, maxTotal - currentCount);

    if (maxNewFiles <= 0) {
      alert(t("mediaLimitReached"));
      return;
    }

    // Valider les fichiers
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
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
        errors.push(`${file.name}: Fichier trop volumineux (${sizeMB}MB > 50MB)`);
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

    // Démarrage des uploads en PARALLÈLE (au lieu de séquentiel)
    // On utilise map au lieu d'une boucle for await pour ne pas bloquer
    validFiles.forEach(async (file, index) => {
      const fileName = file.name;
      const localId = newAttachments[index].id;

      try {
        const attachmentId = await uploadToCloudinary(
          file, 
          (progress) => {
            setUploadProgress((prev) => ({ ...prev, [fileName]: progress }));
          },
          (cancelFn) => {
            // On stocke la fonction d'annulation pour cet ID
            abortControllersRef.current[localId] = cancelFn;
          }
        );

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
        const errorMessage = err instanceof Error ? err.message : "";
        
        // On ne loggue l'erreur et n'alerte l'utilisateur que si ce n'est PAS une annulation volontaire
        if (errorMessage !== "Upload cancelled") {
          console.error(`Erreur upload ${fileName}:`, err);
          const friendlyMessage = getFriendlyErrorMessage(err);
          alert(`Échec pour ${fileName}: ${friendlyMessage}`);
        }

        // Suppression de l'attachement échoué ou annulé de l'UI
        setAttachments((prev) => prev.filter((a) => a.id !== localId));
        
      } finally {
        // Nettoyage de la référence d'annulation et de la progression
        if (abortControllersRef.current[localId]) {
          delete abortControllersRef.current[localId];
        }
        setUploadProgress((prev) => {
          const copy = { ...prev };
          delete copy[fileName];
          return copy;
        });
      }
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (localId: string) => {
    // Si un upload est en cours pour cet ID, on l'annule via le contrôleur
    if (abortControllersRef.current[localId]) {
      abortControllersRef.current[localId](); // Ceci déclenche xhr.abort()
      delete abortControllersRef.current[localId];
    }

    // Le reste du nettoyage se fera dans le bloc catch/finally de handleFiles
    // Mais on update l'UI immédiatement pour la réactivité si ce n'était pas en upload
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (input.trim()) {
        handleBtnClick();
      }
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // After a key is released, recalc the text and cursor position and detect mention start
    const el = editableTextAreaRef.current;
    if (!el) return;

    const text = el.textContent || "";
    const selection = window.getSelection();
    let cursorPos = text.length;
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(el);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      cursorPos = preCaretRange.toString().length;
    }

    setCursorPosition(cursorPos);
    // Trigger mention detection
    detectMentionStart(text, cursorPos, el);
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
          // MODIFICATION ICI : Ajout de flex-wrap, max-h-40, overflow-y-auto
          <div className="flex w-full flex-wrap gap-2 max-h-40 overflow-y-auto p-1">
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
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-xs text-muted-foreground">
                        <FileIcon className="h-4 w-4" />
                        <span className="text-center truncate">{a.fileName?.slice(0, 8)}</span>
                    </div>
                  )}
                </div>

                {/* Overlay de progression avec Pourcentage */}
                {a.isUploading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/60 backdrop-blur-[1px]">
                    <div className="relative flex items-center justify-center">
                        <CircleProgress
                        progress={uploadProgress[a.fileName || ""] ?? 0}
                        size={36}
                        strokeWidth={3}
                        className="text-white"
                        />
                        {/* Affichage du pourcentage au centre */}
                        <span className="absolute text-[10px] font-bold text-white">
                            {Math.round(uploadProgress[a.fileName || ""] ?? 0)}%
                        </span>
                    </div>
                  </div>
                )}

                {/* Bouton de supression / Annulation */}
                <button
                onClick={() => removeAttachment(a.id)}
                className={cn(
                    "absolute top-0.5 right-0.5 z-10 rounded-full bg-destructive/80 p-1 text-white transition-opacity hover:opacity-100 max-sm:opacity-100",
                    a.isUploading ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}
                type="button"
                title={a.isUploading ? "Annuler l'envoi" : "Supprimer"}
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
        <EditableTextArea
          ref={editableTextAreaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onKeyUpProp={handleKeyUp}
          placeholder={t("typeMessage")}
          className={cn(
            expanded ? "relative w-full" : "invisible absolute w-0",
          )}
        />
        {/* Mention Overlay */}
        {mentionState.isActive && roomData && (
          <MentionOverlay
            visible={mentionState.isActive}
            searchQuery={mentionState.searchQuery}
            position={mentionState.position}
            roomMembers={roomData.members || []}
            onSelectMention={handleSelectMention}
            currentUserId={undefined}
          />
        )}
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