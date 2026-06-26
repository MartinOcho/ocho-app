import nodemailer from "nodemailer";

const CONTACT_EMAILS = [
  "contact@ochokom.com",
  "martin@ochokom.com",
  "noreply@ochokom.com",
];

const getTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP configuration is missing. Please set SMTP_HOST, SMTP_USER and SMTP_PASS.",
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });
};

const getFromAddress = () => {
  return process.env.EMAIL_FROM || `OchoApp <${process.env.SMTP_USER}>`;
};

export async function sendAccountDeletionRequestEmails({
  email,
  details,
  scheduledDeletionAt,
}: {
  email: string;
  details: string;
  scheduledDeletionAt: Date;
}) {
  const transporter = getTransporter();
  const from = getFromAddress();

  const internalSubject = "Nouvelle demande de suppression de compte";
  const internalText = `Une nouvelle demande de suppression de compte a été reçue.

Email du demandeur: ${email}
Date de suppression planifiée: ${scheduledDeletionAt.toISOString()}

Détails:
${details || "Aucun détail fourni."}`;

  const confirmationSubject = "Confirmation de réception de votre demande de suppression";
  const confirmationText = `Bonjour,

Nous avons bien reçu votre demande de suppression de compte.
Votre compte sera supprimé dans 7 jours, le ${scheduledDeletionAt.toLocaleString()}.

Si vous souhaitez annuler cette demande, veuillez répondre à cet e-mail ou contacter notre support.

Cordialement,
OchoApp`;

  await transporter.sendMail({
    from,
    to: CONTACT_EMAILS.join(", "),
    subject: internalSubject,
    text: internalText,
  });

  await transporter.sendMail({
    from,
    to: email,
    subject: confirmationSubject,
    text: confirmationText,
  });
}
