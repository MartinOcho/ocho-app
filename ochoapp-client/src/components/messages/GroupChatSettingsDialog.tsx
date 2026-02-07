import { cn } from "@/lib/utils";
import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { RoomData } from "@/lib/types";
import { Label } from "../ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import LoadingButton from "../LoadingButton";
import Resizer from "react-image-file-resizer";
import {
  updateGroupChatProfileSchema,
  UpdateGroupChatProfileValues,
} from "@/lib/validation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useDeleteGroupChatAvatarMutation,
  useUpdateGroupChatMutation,
} from "@/app/(main)/users/[username]/mutations";
import { StaticImageData } from "next/image";
import GroupAvatar from "../GroupAvatar";
import { Camera, Trash2 } from "lucide-react";
import CropImageDialog from "../CropImageDialog";
import { useToast } from "../ui/use-toast";
import { useTranslation } from "@/context/LanguageContext";

interface GroupChatSettingsDialogProps {
  room: RoomData;
  className?: string;
  children: React.ReactNode;
  focus?: "name" | "description" | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function GroupChatSettingsDialog({
  room,
  className,
  children,
  open = false,
  focus,
  onOpenChange,
}: GroupChatSettingsDialogProps) {
  const [croppedAvatar, setCroppedAvatar] = useState<Blob | null>(null);
  const { toast } = useToast();
  const { t } = useTranslation();
  const {
    changeGroupSettings,
    groupIcon,
    groupName,
    changeGroupName,
    groupDescription,
    describeThisGroup,
    save,
    dataError,
  } = t();

  const mutation = useUpdateGroupChatMutation({ roomId: room.id });

  const form = useForm<UpdateGroupChatProfileValues>({
    resolver: zodResolver(updateGroupChatProfileSchema),
    defaultValues: {
      id: room.id,
      name: room?.name || undefined,
      description: room.description || "",
    },
  });

  async function onSubmit(values: UpdateGroupChatProfileValues) {

    const newAvatarFile = croppedAvatar
      ? new File([croppedAvatar], `avatar_${room.id}.webp`)
      : undefined;

    mutation.mutate(
      {
        values,
        avatar: newAvatarFile,
      },
      {
        onSuccess: () => {
          setCroppedAvatar(null);
          onOpenChange(false);
        },
        onError(error, variables, context) {
          toast({
            variant: "destructive",
            description: dataError,
          });
        },
      },
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        asChild
        className={cn("cursor-pointer", className)}
        title={changeGroupSettings}
      >
        {children}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{changeGroupSettings}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-1.5">
          <Label>{groupIcon}</Label>
          <AvatarInput
            roomId={room.id}
            src={
              croppedAvatar
                ? URL.createObjectURL(croppedAvatar)
                : room.groupAvatarUrl
            }
            onImageCropped={setCroppedAvatar}
          />
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{groupName}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={changeGroupName}
                      {...field}
                      autoFocus={focus === "name"}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{groupDescription}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={describeThisGroup}
                      {...field}
                      className="resize-none"
                      autoFocus={focus === "description"}
                      rows={4}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <LoadingButton type="submit" loading={mutation.isPending}>
                {save}
              </LoadingButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

interface AvatarInputProps {
  roomId: string;
  src: string | StaticImageData | null;
  onImageCropped: (blob: Blob | null) => void;
}

function AvatarInput({ roomId, src, onImageCropped }: AvatarInputProps) {

  const { t } = useTranslation();

  const [imageToCrop, setImageToCrop] = useState<File>();

  const mutation = useDeleteGroupChatAvatarMutation();

  const { profilePicture, groupIcon, clickToSelectImage, removePic } = t();

  const fileInputRef = useRef<HTMLInputElement>(null);

  function onImageSelected(image: File | undefined) {
    if (!image) return;

    Resizer.imageFileResizer(
      image,
      1024,
      1024,
      "WEBP",
      100,
      0,
      (uri) => setImageToCrop(uri as File),
      "file",
    );
  }

  function deleteAvatar() {
    mutation.mutate({ roomId });
  }

  return (
    <>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => onImageSelected(e.target.files?.[0])}
        ref={fileInputRef}
        className="sr-only hidden"
        title={groupIcon}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="group relative block"
        title={clickToSelectImage}
      >
        <GroupAvatar avatarUrl={src} size={150} className="flex-none" />
        <span className="absolute inset-0 m-auto flex size-12 items-center justify-center rounded-full bg-black bg-opacity-30 text-white transition-colors duration-200 group-hover:bg-opacity-25">
          <Camera size={24} />
        </span>
      </button>
      {!!src && !src?.toString().startsWith("blob:") && (
        <LoadingButton
          variant="destructive"
          loading={mutation.isPending}
          onClick={deleteAvatar}
        >
          <Trash2 size={20} /> {removePic}
        </LoadingButton>
      )}
      {imageToCrop && (
        <CropImageDialog
          src={URL.createObjectURL(imageToCrop)}
          cropAspectRatio={1}
          onCropped={onImageCropped}
          onClose={() => {
            setImageToCrop(undefined);
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
          }}
        />
      )}
    </>
  );
}
