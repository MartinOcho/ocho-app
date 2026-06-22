import { useToast } from "@/components/ui/use-toast";
import { VocabularyObject } from "@/lib/vocabulary";
import { useState } from "react";

export interface Attachment {
  file: File;
  mediaId?: string;
  isUploading: boolean;
  progress?: number;
}

export default function useMediaUpload() {
  const MAX_FILE_SIZE_MB = 30;
  const MAX_IMAGE_SIZE_MB = 4;

  const { toast } = useToast();
  const [attachments, setAttachment] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [currentFile, setCurrentFile] = useState<Attachment | null>(null);

  async function uploadToCloudinary(
    file: File,
    onProgress: (progress: number) => void,
  ): Promise<{ mediaId: string } | null> {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append("file", file);

      xhr.open("POST", "/api/upload/attachment", true);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
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

      xhr.onerror = () => resolve(null);
      xhr.send(formData);
    });
  }

  async function uploadAttachment(
    file: File,
    onProgress: (progress: number) => void,
  ): Promise<{ mediaId: string }> {
    const uploadResult = await uploadToCloudinary(file, onProgress);
    if (!uploadResult?.mediaId) {
      throw new Error(
        `Failed to upload attachment ${currentFile?.file.name ?? ""}`,
      );
    }
    return uploadResult;
  }

  async function handleStartUpload(files: File[], t: VocabularyObject) {
    const { fileMaxSizeReached } = t;
    setIsUploading(true);

    for (const file of files) {
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
        setAttachment((prev) =>
          prev.filter(
            (a) => a.file.name === file.name && a.file.size === file.size,
          ),
        );
        continue;
      }

      try {
        const attachment = { file, isUploading: true, progress: 0 };
        setAttachment((prev) => [...prev, attachment]);
        setCurrentFile(attachment);

        const { mediaId } = await uploadAttachment(file, (progress) => {
          setAttachment((prev) =>
            prev.map((a) =>
              a.file.name === file.name ? { ...a, progress } : a,
            ),
          );
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
