import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const UPLOAD_DIR = path.join(process.cwd(), 'public/uploads'); // Assurez-vous que ce dossier existe

export function uploadFile(file: File): Promise<{ fileName: string; mediaId: string }> {
    return new Promise((resolve, reject) => {
        const mediaId = uuidv4();
        const fileName = `${mediaId}_${file.name}`;
        const filePath = path.join(UPLOAD_DIR, fileName);
        
        const stream = fs.createWriteStream(filePath);
        const reader = file.stream().getReader();

        const pump = () => reader.read().then(({ done, value }) => {
            if (done) {
                resolve({ fileName, mediaId });
                return;
            }
            stream.write(value);
            pump();
        });

        pump().catch(reject);
    });
}
