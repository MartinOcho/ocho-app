"use client";

import useFollowerInfo from "@/hooks/useFollowerInfo";
import { FollowerInfo } from "@/lib/types";
import FormattedInt from "./FormattedInt";
import { useTranslation } from "@/context/LanguageContext";

interface FollowerCountProps {
  userId: string;
  initialState: FollowerInfo;
}

export default function FollowerCount({
  userId,
  initialState,
}: FollowerCountProps) {
  const { t } = useTranslation();
  const { data } = useFollowerInfo(userId, initialState);
  const {follower, followers} = t()

  return (
    <span>
      <span className="font-semibold">
        <FormattedInt number={data.followers} />
      </span>{" "}
      {data.followers > 1 ? followers : follower}
    </span>
  );
}
