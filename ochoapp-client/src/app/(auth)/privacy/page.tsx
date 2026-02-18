import LegalPageRenderer from "@/components/LegalPageRenderer";

export default function Page() {
  return (
    <LegalPageRenderer
      docType="privacy"
      title={{
        fr: "Politique de Confidentialité de OchoApp",
        en: "Privacy Policy of OchoApp",
      }}
    />
  );
}