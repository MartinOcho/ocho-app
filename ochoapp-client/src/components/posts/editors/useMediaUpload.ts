// components/posts/editors/useMediaUpload.ts
import { useToast } from "@/components/ui/use-toast";
import { useUploadThing } from "@/lib/uploadthing";
import { VocabularyObject } from "@/lib/vocabulary";
import { useState } from "react";

export interface Attachment {
  file: File;
  mediaId?: string;
  isUploading: boolean;
  progress?: number;
}

export default function useMediaUpload() {
  const MAX_FILE_SIZE_MB = 30; // Limite de taille de fichier en Mo
  const MAX_IMAGE_SIZE_MB = 4; // Limite de taille de fichier en Mo

  const { toast } = useToast();
  const [attachments, setAttachment] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [currentFile, setCurrentFile] = useState<Attachment | null>(null);

  const { startUpload: startAttachmentUpload } = useUploadThing("attachment", {
    onUploadProgress: (progress) => {
      if (currentFile) {
        setAttachment((prev) =>
          prev.map((a) =>
            a.mediaId === currentFile.mediaId ? { ...a, progress } : a,
          ),
        );
      }
    },
  });

  async function uploadOnLocalServer(
    file: File,
    onProgress: (progress: number) => void,
  ): Promise<{ mediaId: string } | null> {
    return new Promise((resolve) => {
      if (process.env.NODE_ENV === "production") {
        resolve(null); // Simuler une réponse null pour le serveur local
        return;
      }
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append("avatar", file);

      xhr.open("POST", "/api/upload/attachment", true);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          resolve({ mediaId: response.mediaId });
        } else {
          resolve(null);
        }
      };

      xhr.onerror = () => {
        resolve(null);
      };

      xhr.send(formData);
    });
  }

  async function uploadAttachment(
    file: File,
    onProgress: (progress: number) => void,
  ): Promise<{ mediaId: string }> {
    return new Promise(async (resolve, reject) => {
      // Try to upload on local
      const localUpload = await uploadOnLocalServer(file, (progress) => {
        onProgress(progress);
      });
      if (localUpload) {
        resolve(localUpload);
      } else {
        const uploadResult = startAttachmentUpload([file]);
        
        uploadResult.then((result) => {
          const mediaId = result?.[0].serverData.mediaId;
          if (!result || !result?.length || !mediaId) {
            reject(
              `Failed to upload attachment ${currentFile?.file.name ?? ""} check your connection or file size`,
            );
            setCurrentFile(null);
            return;
          }
          setAttachment((prev) =>
            prev.map((a) =>
              a.mediaId === currentFile?.mediaId
                ? { ...a, mediaId, isUploading: false, progress: 100 }
                : a,
            ),
          );
          resolve({ mediaId });
          setCurrentFile(null);
          setIsUploading(false);
        }).catch((error) => {
          console.warn(error);
          reject(
            `Failed to upload attachment ${currentFile?.file.name ?? ""}`,
          );
          setCurrentFile(null);
          setIsUploading(false)
        })
      }
    });
  }

  async function handleStartUpload(files: File[], t :VocabularyObject) {
    const { fileMaxSizeReached } = t;
    setIsUploading(true);
    const newAttachments: Attachment[] = [];

    for (const file of files) {
      // Vérifier la taille du fichier
      const fileSizeMB = file.size / 1024 ** 2;
      if (
        fileSizeMB > MAX_FILE_SIZE_MB ||
        (file.type.startsWith("image/") && fileSizeMB > MAX_IMAGE_SIZE_MB)
      ) {
        toast({
          variant: "destructive",
          description: fileMaxSizeReached
            .replace("[name]", file.name)
            .replace(
              "[size]",
              `${file.type.startsWith("image/") ? MAX_IMAGE_SIZE_MB : MAX_FILE_SIZE_MB} Mo.`,
            ),
        });
        setAttachment(
          attachments.filter(
            (a) => a.file.name === file.name && a.file.size === file.size,
          ),
        );
        continue; // Passer au fichier suivant
      }

      try {
        const attachment = { file, isUploading: true, progress: 0 };
        newAttachments.push(attachment);
        setAttachment((prev) => [...prev, attachment]);
        setCurrentFile(attachment);
        const { mediaId } = await uploadAttachment(file, (progress) => {
          setAttachment((prev) =>
            prev.map((a) =>
              a.file.name === file.name ? { ...a, progress } : a,
            ),
          );
        }).catch((error) => {
          console.error(error);
          throw new Error(error);
        });

        setAttachment((prev) =>
          prev.map((a) =>
            a.file.name === file.name
              ? { ...a, mediaId, isUploading: false, progress: 100 }
              : a,
          ),
        );
        setCurrentFile(null);
      } catch (error) {
        toast({
          variant: "destructive",
          description: (error as Error).message,
        });
        setCurrentFile(null);
        setAttachment((prev) =>
          prev.map((a) =>
            a.file.name === file.name
              ? { ...a, isUploading: false, progress: 0 }
              : a,
          ),
        );
      }
    }

    setIsUploading(false);
  }

  function removeAttachment(fileName: string) {
    setAttachment((prev) => prev.filter((a) => a.file.name !== fileName));
  }

  function reset() {
    setAttachment([]);
    setIsUploading(false);
    setCurrentFile(null);
  }

  return {
    startUpload: handleStartUpload,
    attachments,
    isUploading,
    removeAttachment,
    reset,
  };
}
