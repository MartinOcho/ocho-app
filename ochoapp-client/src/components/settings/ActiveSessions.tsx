"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import LoaderMain from "@/components/LoaderMain";
import { toast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Monitor,
  Smartphone,
  Tablet,
  Laptop,
  Clock,
  MapPin,
  Wifi,
  Trash2,
  Shield,
} from "lucide-react";

interface Session {
  sessionId: string;
  expiresAt: Date;
  isCurrent: boolean;
}

interface Device {
  deviceId: string;
  type: string;
  model: string | null;
  ip: string | null;
  location: string | null;
  createdAt: Date;
  updatedAt: Date;
  sessions: Session[];
}

interface SessionsResponse {
  currentSessionId: string;
  devices: Device[];
}

async function fetchActiveSessions(): Promise<SessionsResponse> {
  const response = await fetch("/api/auth/active-sessions");
  if (!response.ok) {
    throw new Error("Erreur lors du chargement des sessions");
  }
  return response.json();
}

async function removeSession(sessionId: string): Promise<void> {
  const response = await fetch(`/api/auth/active-sessions/${sessionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });

  if (!response.ok) {
    throw new Error("Erreur lors de la suppression de la session");
  }
}

const getDeviceIcon = (type: string) => {
  const baseClassName = "w-6 h-6";
  switch (type.toUpperCase()) {
    case "ANDROID":
    case "IOS":
      return <Smartphone className={baseClassName} />;
    case "TABLET":
      return <Tablet className={baseClassName} />;
    case "DESKTOP":
      return <Laptop className={baseClassName} />;
    case "WEB":
      return <Monitor className={baseClassName} />;
    default:
      return <Monitor className={baseClassName} />;
  }
};

const getDeviceName = (type: string, model: string | null): string => {
  const typeMap: Record<string, string> = {
    ANDROID: "Android",
    IOS: "iPhone / iPad",
    TABLET: "Tablette",
    DESKTOP: "Ordinateur",
    WEB: "Navigateur Web",
  };

  const baseName = typeMap[type.toUpperCase()] || type;
  return model ? `${baseName} - ${model}` : baseName;
};

export default function ActiveSessions() {
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const {
    data: sessionsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["activeSessions"],
    queryFn: fetchActiveSessions,
    staleTime: 1000 * 60,
  });

  const removeMutation = useMutation({
    mutationFn: removeSession,
    onSuccess: () => {
      toast({
        description: "Session supprimée avec succès",
      });
      setSelectedSession(null);
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["activeSessions"] });
    },
    onError: (error) => {
      toast({
        description:
          error instanceof Error
            ? error.message
            : "Erreur lors de la suppression de la session",
        variant: "destructive",
      });
    },
  });

  const handleRemoveSession = (sessionId: string) => {
    setSelectedSession(sessionId);
    setIsDialogOpen(true);
  };

  const confirmRemove = () => {
    if (selectedSession) {
      removeMutation.mutate(selectedSession);
    }
  };

  if (isLoading) return <LoaderMain />;
  if (error) {
    return (
      <div className="rounded-lg border bg-muted p-4 text-foreground">
        Erreur lors du chargement des sessions
      </div>
    );
  }

  if (!sessionsData?.devices || sessionsData.devices.length === 0) {
    return (
      <div className="rounded-lg border bg-muted p-6 text-center text-muted-foreground">
        <p>Aucun appareil connecté trouvé</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg bg-accent/50 p-4 text-foreground">
        <Shield className="w-5 h-5" />
        <p className="text-sm">
          Vous pouvez déconnecter les appareils auxquels vous n'avez plus
          accès.
        </p>
      </div>

      <div className="space-y-4">
        {sessionsData.devices.map((device) => (
          <div
            key={device.deviceId}
            className="rounded-lg border bg-card p-4 shadow-sm transition-all hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-1 items-start gap-4">
                <div className="rounded-lg bg-muted p-3">
                  {getDeviceIcon(device.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground">
                    {getDeviceName(device.type, device.model)}
                  </h3>

                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {device.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 flex-shrink-0" />
                        <span>{device.location}</span>
                      </div>
                    )}

                    {device.ip && (
                      <div className="flex items-center gap-2">
                        <Wifi className="w-4 h-4 flex-shrink-0" />
                        <span className="font-mono">{device.ip}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 flex-shrink-0" />
                      <span>
                        Dernière activité:{" "}
                        {new Date(device.updatedAt).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>

                  {device.sessions.length > 0 && (
                    <div className="mt-3 rounded-md bg-muted p-2">
                      <p className="text-xs font-medium text-foreground">
                        {device.sessions.length} session{device.sessions.length > 1 ? "s" : ""} active{device.sessions.length > 1 ? "s" : ""}
                      </p>
                      <ul className="mt-1 space-y-1">
                        {device.sessions.map((sess) => (
                          <li
                            key={sess.sessionId}
                            className="flex items-center justify-between text-xs text-muted-foreground"
                          >
                            <span>
                              Expire le{" "}
                              {new Date(sess.expiresAt).toLocaleDateString(
                                "fr-FR"
                              )}
                            </span>
                            {sess.isCurrent && (
                              <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-foreground font-medium">
                                Session actuelle
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-shrink-0 flex-col gap-2">
                {device.sessions.some((s) => !s.isCurrent) && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      const nonCurrentSession = device.sessions.find(
                        (s) => !s.isCurrent
                      );
                      if (nonCurrentSession) {
                        handleRemoveSession(nonCurrentSession.sessionId);
                      }
                    }}
                    disabled={removeMutation.isPending}
                    className="gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Déconnecter
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Déconnecter cet appareil</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir déconnecter cet appareil ? Vous devrez vous
              reconnecter si vous accédez à votre compte depuis cet appareil.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={confirmRemove}
              disabled={removeMutation.isPending}
            >
              {removeMutation.isPending ? "Suppression..." : "Déconnecter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
