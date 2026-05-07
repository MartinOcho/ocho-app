/**
 * Utilitaires pour traiter les fichiers audio
 * Génère des waves (tableau d'entiers) à partir de données audio
 */

import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { createWriteStream, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';

// Configurer ffmpeg avec le chemin statique
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

/**
 * Interface représentant les waves audio converties
 * - Valeurs entre 1-100 basées sur l'intensité audio
 */
export interface AudioWaves {
  waves: number[];
  duration: number;
}

/**
 * Convertit un buffer audio en tableau de waves
 * Décode correctement les fichiers audio compressés (WebM, OGG, MP3, etc.)
 * 
 * @param audioBuffer - Buffer contenant les données audio (WAV, WebM, OGG, MP3, etc.)
 * @param duration - Durée estimée de l'audio en secondes
 * @returns Objet contenant le tableau des waves et la durée
 */
export async function generateWavesFromAudio(
  audioBuffer: Buffer,
  duration: number
): Promise<AudioWaves> {
  let tempInputPath = '';
  let tempOutputPath = '';
  
  try {
    // Créer des fichiers temporaires
    const tempDir = tmpdir();
    const tempId = randomUUID();
    tempInputPath = join(tempDir, `audio_${tempId}.webm`);
    tempOutputPath = join(tempDir, `audio_${tempId}.wav`);
    
    // Écrire le buffer d'entrée dans un fichier temporaire
    await new Promise<void>((resolve, reject) => {
      const stream = createWriteStream(tempInputPath);
      stream.write(audioBuffer);
      stream.end();
      stream.on('finish', resolve);
      stream.on('error', reject);
    });
    
    // Décoder avec ffmpeg
    await new Promise<void>((resolve, reject) => {
      ffmpeg(tempInputPath)
        .toFormat('wav')
        .audioCodec('pcm_s16le')
        .on('error', reject)
        .on('end', () => resolve())
        .save(tempOutputPath);
    });
    
    // Lire le fichier WAV décodé
    const wavBuffer = readFileSync(tempOutputPath);
    
    // Extraire les données PCM du WAV
    const pcmData = extractWavPCM(wavBuffer);
    
    // Générer les waves basées sur les données audio
    const waves = processAudioToPeaks(pcmData, duration);
    
    return {
      waves,
      duration,
    };
  } catch (error) {
    console.error("Erreur lors de la génération des waves:", error);
    // Retourner des waves par défaut si erreur
    return generateDefaultWaves(duration);
  } finally {
    // Nettoyer les fichiers temporaires
    try {
      if (tempInputPath) {
        try {
          unlinkSync(tempInputPath);
        } catch (e) {
          // Ignorer
        }
      }
      if (tempOutputPath) {
        try {
          unlinkSync(tempOutputPath);
        } catch (e) {
          // Ignorer
        }
      }
    } catch (e) {
      // Ignorer les erreurs de suppression
    }
  }
}

/**
 * Extrait les données PCM d'un fichier WAV
 */
function extractWavPCM(buffer: Buffer): Int16Array {
  try {
    // Trouver le chunk "data"
    let dataOffset = -1;
    let dataSize = 0;
    
    for (let i = 12; i < buffer.length - 8; i++) {
      if (buffer.toString("ascii", i, i + 4) === "data") {
        dataOffset = i + 8;
        dataSize = buffer.readUInt32LE(i + 4);
        break;
      }
    }
    
    if (dataOffset === -1) {
      console.warn("Chunk 'data' non trouvé dans le WAV");
      return new Int16Array(0);
    }
    
    // Extraire les données PCM 16-bit
    const pcmBuffer = buffer.slice(dataOffset, dataOffset + dataSize);
    return new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.length / 2);
  } catch (error) {
    console.error("Erreur lors de l'extraction WAV PCM:", error);
    return new Int16Array(0);
  }
}

/**
 * Convertit les données PCM en tableau de peaks pour les waves
 * Utilise la méthode RMS (Root Mean Square) pour déterminer l'intensité audio
 * Génère un point toutes les 100ms (0.1 secondes)
 * Chaque point entre 1 et 100 selon l'intensité audio
 */
function processAudioToPeaks(pcmData: Int16Array, duration: number): number[] {
  const peaks: number[] = [];
  
  if (pcmData.length === 0) {
    // Retourner au minimum 10 points par défaut (silence)
    const minPoints = 10;
    for (let i = 0; i < minPoints; i++) {
      peaks.push(1);
    }
    return peaks;
  }
  
  // Calculer la sample rate basée sur la durée et la longueur du PCM
  const sampleRate = Math.round(pcmData.length / duration);
  
  // Génération toutes les 100ms (0.1 secondes) pour plus de détails
  const intervalSeconds = 0.1;
  const samplesPerInterval = Math.max(1, Math.floor(sampleRate * intervalSeconds));
  
  // RMS (Root Mean Square) pour l'énergie audio
  let maxRMS = 0;
  const rmsValues: number[] = [];
  
  // Calculer le RMS pour chaque intervalle
  for (let i = 0; i < pcmData.length; i += samplesPerInterval) {
    const endIndex = Math.min(i + samplesPerInterval, pcmData.length);
    
    let sumOfSquares = 0;
    for (let j = i; j < endIndex; j++) {
      sumOfSquares += pcmData[j] * pcmData[j];
    }
    
    const rms = Math.sqrt(sumOfSquares / (endIndex - i));
    rmsValues.push(rms);
    maxRMS = Math.max(maxRMS, rms);
  }
  
  // Normaliser les RMS values entre 1 et 100
  if (maxRMS === 0) {
    // Si aucun son détecté, retourner des 1
    return rmsValues.map(() => 1);
  }
  
  // Normaliser: 1 à 100
  // Utiliser une courbe logarithmique pour une meilleure répartition visuelle
  const minThreshold = maxRMS * 0.02; // 2% du max RMS comme seuil de bruit
  
  for (const rms of rmsValues) {
    let normalized;
    
    if (rms < minThreshold) {
      // Silence détecté
      normalized = 1;
    } else {
      // Normaliser en soustrayant le seuil
      const adjustedRMS = rms - minThreshold;
      const maxAdjusted = maxRMS - minThreshold;
      normalized = Math.max(1, Math.round((adjustedRMS / maxAdjusted) * 100));
    }
    
    peaks.push(Math.min(100, normalized));
  }
  
  return peaks;
}

/**
 * Génère un tableau de waves par défaut en cas d'erreur
 */
function generateDefaultWaves(duration: number): AudioWaves {
  const numPoints = Math.max(10, Math.min(50, Math.ceil(duration * 10)));
  const waves: number[] = [];
  
  // Générer une forme d'onde lissée
  for (let i = 0; i < numPoints; i++) {
    // Silence au début et à la fin, du bruit au milieu
    const progress = i / numPoints;
    if (progress < 0.1 || progress > 0.9) {
      // Silence
      waves.push(1);
    } else {
      // Son
      waves.push(Math.floor(Math.random() * 40) + 30);
    }
  }
  
  return {
    waves,
    duration,
  };
}

/**
 * Convertit un string base64 en Buffer
 */
export function base64ToBuffer(base64String: string): Buffer {
  // Enlever le préfixe data:audio/... si présent
  const base64Data = base64String.includes(",")
    ? base64String.split(",")[1]
    : base64String;
  
  return Buffer.from(base64Data, "base64");
}
