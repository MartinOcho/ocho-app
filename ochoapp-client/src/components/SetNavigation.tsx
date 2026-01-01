"use client"

import { NavigationType } from "@/lib/types";
import { useNavigation } from "@/context/NavigationContext";
import { useEffect } from "react";



interface SetNavigationProps{
    navPage: NavigationType
}

export default function SetNavigation({navPage} : SetNavigationProps) {
    const {setCurrentNavigation} = useNavigation();
    useEffect(()=>{
        setCurrentNavigation(navPage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    },[])
   return <span className="hidden"></span>
};
