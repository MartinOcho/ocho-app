"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { oauthCompleteSchema, OAuthCompleteValues } from "@/lib/validation";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import LoadingButton from "@/components/LoadingButton";
import { completeOAuthAccount } from "./actions";
import { useTranslation } from "@/context/LanguageContext";

interface OAuthCompleteFormProps {
  pendingData: {
    provider: string;
    userId: string;
    email?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    usernameSuggestion?: string | null;
  };
}

export default function OAuthCompleteForm({
  pendingData,
}: OAuthCompleteFormProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const { fullName, username, yourFullName, yourUsername, finishAccount } = t();
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const form = useForm<OAuthCompleteValues>({
    resolver: zodResolver(oauthCompleteSchema),
    defaultValues: {
      username: pendingData.usernameSuggestion ?? "",
      displayName: pendingData.displayName ?? "",
    },
  });

  async function onSubmit(values: OAuthCompleteValues) {
    setError(undefined);
    startTransition(async () => {
      const result = await completeOAuthAccount({
        ...values,
        provider: pendingData.provider,
        providerUserId: pendingData.userId,
        email: pendingData.email ?? undefined,
        avatarUrl: pendingData.avatarUrl ?? undefined,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      router.push("/");
      router.refresh();
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {error && <p className="text-center text-sm text-destructive">{error}</p>}
        <FormField
          control={form.control}
          name="displayName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{fullName}</FormLabel>
              <FormControl>
                <Input placeholder={yourFullName} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{username}</FormLabel>
              <FormControl>
                <Input placeholder={yourUsername} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <LoadingButton loading={isPending} type="submit" className="w-full">
          {finishAccount}
        </LoadingButton>
      </form>
    </Form>
  );
}
