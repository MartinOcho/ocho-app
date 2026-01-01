"use client"

import { Button } from "@/components/ui/button";
import { UserData } from "@/lib/types";
import { useState } from "react";
import EditProfileDialog from "./EditProfileDialog";
import { t } from "@/context/LanguageContext";



interface EditProfileButtonProps{
    user: UserData;
}

export default function EditProfileButton({user}: EditProfileButtonProps) {
    const [showDialog, setShowDialog] = useState(false);
    const {editProfile} = t();

    return <>
    <Button variant="outline" onClick={()=>setShowDialog(true)}>{editProfile}</Button>
    <EditProfileDialog user={user} open={showDialog} onOpenChange={setShowDialog}/>
    </>

};
