import LegalPageRenderer from "@/components/LegalPageRenderer";

export default function Page() {
  return (
    <LegalPageRenderer
      docType="terms-of-use"
      title={{
        fr: "Conditions d'Utilisation de OchoApp",
        en: "Terms of Use of OchoApp",
      }}
    />
  );
}
