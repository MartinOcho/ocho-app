"use client";

import { loginSchema, LoginValues } from "@/lib/validation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useState, useTransition } from "react";
import { PasswordInput } from "@/components/PasswordInput";
import LoadingButton from "@/components/LoadingButton";
import { login } from "./actions";
import { useTranslation } from "@/context/LanguageContext";

import { useSearchParams } from "next/navigation";

export default function LoginForm() {
  const { t } = useTranslation();
  const { username, yourUsername, password, yourPassword, signIn } = t();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo");

  const [error, setError] = useState<string>();

  const [isPending, startTransition] = useTransition();

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  async function onSubmit(values: LoginValues) {
    setError(undefined);
    startTransition(async () => {
      const { error } = await login(values, redirectTo || undefined);
      if (error) {
        // Traduire l'erreur si c'est une clé
        const translatedError = (t() as any)[error] || error;
        setError(translatedError);
      }
    });
  }
  return (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
            {error && <p className="text-center text-destructive">{error}</p>}
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
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{password}</FormLabel>
                  <FormControl>
                    <PasswordInput placeholder={yourPassword} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <LoadingButton loading={isPending} type="submit" className="w-full">
              {signIn}
            </LoadingButton>
          </form>
        </Form>
  );
}