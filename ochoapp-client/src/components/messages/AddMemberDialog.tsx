"use client";

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogHeader,
} from "../ui/dialog";
import { RoomData } from "@/lib/types";
import { useState } from "react";
import AddMemberForm from "./AddMemberForm";
import { cn } from "@/lib/utils";
import { t } from "@/context/LanguageContext";

interface AddMemberDialogProps {
  room: RoomData;
  className?: string;
  children: React.ReactNode;
}

export default function AddMemberDialog({
  room,
  className,
  children,
}: AddMemberDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const {addMembers} = t();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger
        asChild
        className={cn("cursor-pointer", className)}
        title={addMembers}
      >
        {children}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{addMembers}</DialogTitle>
        </DialogHeader>
        <AddMemberForm onAdd={() => setIsOpen(false)} room={room} />
      </DialogContent>
    </Dialog>
  );
}
