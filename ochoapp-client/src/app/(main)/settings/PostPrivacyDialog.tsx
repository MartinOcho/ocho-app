import { useState, useEffect } from "react";
import { useSession } from "../SessionProvider";
import { t } from "@/context/LanguageContext";
import LoadingButton from "@/components/LoadingButton";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { PrivacyValue, PrivacyType } from "@/lib/types";
import kyInstance from "@/lib/ky";

export default function PostPrivacyDialog() {
  const { user } = useSession();
  const [selectedValue, setSelectedValue] = useState<PrivacyValue>("PUBLIC");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const lang = t([
    "postPrivacy",
    "public",
    "private",
    "followers",
    "everyone",
    "noOne",
    "save",
    "somethingWentWrong"
  ]);

  const options: { value: PrivacyValue; label: string; description: string }[] = [
    { value: "PUBLIC", label: lang.everyone, description: "Anyone on the platform can see your posts" },
    { value: "FOLLOWERS", label: lang.followers, description: "Only people who follow you can see your posts" },
    { value: "PRIVATE", label: lang.private, description: "Only you can see your posts" },
    { value: "NO_ONE", label: lang.noOne, description: "No one can see your posts" },
  ];

  useEffect(() => {
    const fetchCurrentSetting = async () => {
      try {
        const response = await kyInstance.get('/api/privacy').json<Record<string, string>>();
        if (response.ok) {
          const settings = response;
          const currentValue = settings.POST_VISIBILITY as PrivacyValue;
          if (currentValue) {
            setSelectedValue(currentValue);
          }
        }
      } catch (err) {
        console.error('Error fetching privacy settings:', err);
      } finally {
        setIsFetching(false);
      }
    };

    fetchCurrentSetting();
  }, []);

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await kyInstance.post('/api/privacy', {
        body: JSON.stringify({
          type: "POST_VISIBILITY" as PrivacyType,
          value: selectedValue
        }),
      }).json<Record<string, string>>();

      const data = response;

      if (response.ok) {
        setSuccess(true);
      } else {
        setError(data.error || lang.somethingWentWrong);
      }
    } catch (err) {
      setError(lang.somethingWentWrong);
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="flex flex-col items-center gap-5">
        <h4 className="text-center text-xl">{lang.postPrivacy}</h4>
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <h4 className="text-center text-xl">{lang.postPrivacy}</h4>

      <div className="flex flex-col gap-3 w-full">
        {options.map((option) => (
          <Button
            key={option.value}
            variant={selectedValue === option.value ? "default" : "outline"}
            onClick={() => setSelectedValue(option.value)}
            className="justify-start h-auto p-4"
            disabled={isLoading}
          >
            <div className="flex flex-col items-start">
              <span className="font-medium">{option.label}</span>
              <span className="text-sm text-muted-foreground">{option.description}</span>
            </div>
          </Button>
        ))}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>Privacy setting updated successfully</AlertDescription>
        </Alert>
      )}

      <LoadingButton onClick={handleSave} loading={isLoading} className="w-full">
        {lang.save}
      </LoadingButton>
    </div>
  );
}
