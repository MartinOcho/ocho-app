"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error");
  const message = searchParams.get("message");

  const getErrorDetails = (code: string | null) => {
    switch (code) {
      case "DEVICE_NOT_REGISTERED":
        return {
          title: "Appareil non enregistré",
          message: "Votre appareil n'est pas enregistré sur la plateforme OchoApp.",
          description: "Pour accéder à cette fonctionnalité, vous devez mettre à jour votre application à la dernière version.",
          icon: "📱",
          actions: [
            {
              label: "Télécharger la dernière version",
              href: "https://github.com/MartinOcho/ocho-app/releases/download/app/app-release.apk",
              primary: true
            }
          ]
        };
      case "DEVICE_REGISTRATION_FAILED":
        return {
          title: "Enregistrement de l'appareil impossible",
          message: "Une erreur s'est produite lors de l'enregistrement de l'appareil.",
          description: "Veuillez réessayer plus tard ou contacter le support si le problème persiste.",
          icon: "❌",
          actions: []
        };
      case "GOOGLE_SIGNIN_FAILED":
        return {
          title: "Authentification Google impossible",
          message: "Une erreur s'est produite lors de l'authentification avec Google.",
          description: "Veuillez réessayer plus tard ou contacter le support si le problème persiste.",
          icon: "❌",
          actions: []
        };
      case "INTERNAL_ERROR":
        return {
          title: "Erreur d'authentification",
          message: "Une erreur s'est produite lors de l'authentification.",
          description: "Veuillez réessayer plus tard ou contacter le support si le problème persiste.",
          icon: "⚠️",
          actions: []
        };
      default:
        return {
          title: "Erreur",
          message: message || "Une erreur s'est produite.",
          description: "Veuillez réessayer ou contacter le support.",
          icon: "❌",
          actions: []
        };
    }
  };

  const errorDetails = getErrorDetails(errorCode);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card d'erreur */}
        <div className="bg-card rounded-lg shadow-lg p-8 space-y-6 border border-border">
          {/* Icône */}
          <div className="flex justify-center">
            <div className="text-5xl">{errorDetails.icon}</div>
          </div>

          {/* Titre */}
          <h1 className="text-2xl font-bold text-center text-card-foreground">
            {errorDetails.title}
          </h1>

          {/* Message */}
          <div className="space-y-2">
            <p className="text-center text-card-foreground font-medium">
              {errorDetails.message}
            </p>
            <p className="text-center text-muted-foreground text-sm">
              {errorDetails.description}
            </p>
          </div>

          {/* Code d'erreur */}
          {errorCode && (
            <div className="bg-secondary rounded-lg p-3 border border-border">
              <p className="text-xs text-muted-foreground text-center font-mono">
                Code: {errorCode}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3 pt-4">
            {errorDetails.actions.length > 0 ? (
              <>
                {errorDetails.actions.map((action, index) => (
                  <a
                    key={index}
                    href={action.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`block w-full py-3 px-4 rounded-lg font-medium text-center transition ${
                      action.primary
                        ? "bg-primary text-primary-foreground hover:opacity-90"
                        : "bg-secondary text-secondary-foreground hover:opacity-80 border border-border"
                    }`}
                  >
                    {action.label}
                  </a>
                ))}
              </>
            ) : null}

            {/* Bouton de retour */}
            <Link
              href="/"
              className="block w-full py-3 px-4 rounded-lg font-medium text-center bg-secondary text-secondary-foreground hover:opacity-80 border border-border transition"
            >
              Retour à l'accueil
            </Link>
          </div>

          {/* Support */}
          <div className="bg-secondary rounded-lg p-4 border border-border">
            <p className="text-xs text-muted-foreground text-center">
              Si vous avez besoin d'aide, veuillez contacter notre support.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-muted-foreground">
          <p>OchoApp v2.0+</p>
        </div>
      </div>
    </div>
  );
}
