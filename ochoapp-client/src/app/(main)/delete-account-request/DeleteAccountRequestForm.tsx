"use client";

import { FormEvent, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import kyInstance from "@/lib/ky";
import { Mail, Info } from "lucide-react";
import { useTranslation } from "@/context/LanguageContext";

export default function DeleteAccountRequestForm() {
  const { t } = useTranslation();
  const {
    deleteAccountRequestTitle,
    deleteAccountRequestDescription,
    deleteAccountRequestEmail,
    deleteAccountRequestDetails,
    deleteAccountRequestSubmit,
    deleteAccountRequestSuccess,
    deleteAccountRequestError,
    deleteAccountRequestMandatoryEmail,
    contactEmails: contactEmailsLabel,
    contactEmailsDescription,
  } = t();

  const [email, setEmail] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSuccess(false);

    if (!email.trim()) {
      setError(deleteAccountRequestMandatoryEmail);
      return;
    }

    startTransition(async () => {
      try {
        const response = await kyInstance
          .post("/api/delete-account-request", {
            json: { email: email.trim(), details: details.trim() },
          })
          .json<{ message: string }>();

        setIsSuccess(true);
        setEmail("");
        setDetails("");
        toast({
          title: deleteAccountRequestSuccess,
          description: response.message,
        });
      } catch (err) {
        setError(deleteAccountRequestError);
      }
    });
  };

  return (
    <div className="bg-card/50 p-5 shadow-sm sm:rounded-2xl sm:bg-card">
      <div className="flex items-center gap-3 mb-4">
        <Mail size={24} />
        <div>
          <h1 className="text-2xl font-bold">{deleteAccountRequestTitle}</h1>
          <p className="text-sm text-muted-foreground">
            {deleteAccountRequestDescription}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="requestEmail" className="text-sm font-medium">
            {deleteAccountRequestEmail}
          </label>
          <Input
            id="requestEmail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="requestDetails" className="text-sm font-medium">
            {deleteAccountRequestDetails}
          </label>
          <Textarea
            id="requestDetails"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder={deleteAccountRequestDescription}
            rows={5}
            className="min-h-[140px]"
          />
        </div>

        {error ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {isSuccess ? (
          <div className="rounded-2xl border border-success/30 bg-success/10 p-3 text-sm text-success">
            {deleteAccountRequestSuccess}
          </div>
        ) : null}

        <Button type="submit" disabled={isPending} className="w-full">
          {deleteAccountRequestSubmit}
        </Button>
      </form>

      <div className="mt-6 rounded-2xl border border-border p-4 bg-secondary/50">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Info size={18} />
          <span>{contactEmailsLabel}</span>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          {contactEmailsDescription}
        </p>
        <ul className="mt-3 space-y-2">
          {[
            "contact@ochokom.com",
            "martin@ochokom.com",
            "noreply@ochokom.com",
          ].map((emailAddress) => (
            <li key={emailAddress}>
              <a href={`mailto:${emailAddress}`} className="text-primary underline">
                {emailAddress}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
