import { NextRequest, NextResponse } from "next/server";

// IMPORTANT: UploadThing est un service de stockage Cloud.
// Le téléchargement est généralement géré en redirigeant l'utilisateur vers l'URL sécurisée du fichier.

export async function GET(request: NextRequest) {
  
  const uploadThingFileUrl = "https://github.com/MartinOcho/ocho-app/releases/download/app/app-release.apk"; 
  
  try {
    // 3. Vérifier si l'URL est valide
    if (!uploadThingFileUrl) {
        return NextResponse.json({ error: "File URL is missing" }, { status: 404 });
    }
    
    // Le code 302 (Found) ou 307 (Temporary Redirect) est utilisé pour rediriger le navigateur.
    return NextResponse.redirect(uploadThingFileUrl, 307); 

  } catch (error) {
    console.error("Error during download process (UploadThing redirection):", error);
    return NextResponse.json({ error: "Error processing download request" }, { status: 500 });
  }
}