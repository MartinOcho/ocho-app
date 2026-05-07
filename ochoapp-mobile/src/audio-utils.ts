/**
 * Utilitaires pour traiter les fichiers audio
 * Génère des waves (tableau d'entiers) à partir de données audio
 */

/**
 * Interface représentant les waves audio converties
 * - Valeurs entre 20-100 basées sur la durée
 * - Valeurs entre 1-100 basées sur l'intensité
 */
export interface AudioWaves {
  waves: number[];
  duration: number;
}

/**
 * Convertit un buffer audio en tableau de waves
 * 
 * @param audioBuffer - Buffer contenant les données audio (WAV ou WebM)
 * @param duration - Durée de l'audio en secondes
 * @returns Objet contenant le tableau des waves et la durée
 */
export async function generateWavesFromAudio(
  audioBuffer: Buffer,
  duration: number
): Promise<AudioWaves> {
  try {
    // Extraire les données PCM du buffer audio
    const pcmData = extractPCMData(audioBuffer);
    
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
  }
}

/**
 * Extrait les données PCM d'un buffer audio
 * Supporte les formats WAV et WebM/OGG
 */
function extractPCMData(audioBuffer: Buffer): Int16Array {
  try {
    // Vérifier si c'est un fichier WAV
    if (isWavFile(audioBuffer)) {
      return extractWavPCM(audioBuffer);
    }
    
    // Pour WebM/OGG et autres formats, utiliser une approximation
    // basée sur les bytes du fichier
    return approximatePCMFromBuffer(audioBuffer);
  } catch (error) {
    console.error("Erreur lors de l'extraction PCM:", error);
    return new Int16Array(0);
  }
}

/**
 * Vérifie si le buffer est un fichier WAV
 */
function isWavFile(buffer: Buffer): boolean {
  // Vérifier la signature WAV (RIFF....WAVE)
  if (buffer.length < 12) return false;
  
  const riff = buffer.toString("ascii", 0, 4);
  const wave = buffer.toString("ascii", 8, 12);
  
  return riff === "RIFF" && wave === "WAVE";
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
 * Approxime les données PCM à partir d'un buffer quelconque
 * Utilisé pour les formats compressés (WebM, OGG, etc.)
 */
function approximatePCMFromBuffer(buffer: Buffer): Int16Array {
  // Créer un tableau de 16-bit à partir des octets disponibles
  const length = Math.min(buffer.length / 2, 8192); // Limiter à 8KB
  const pcm = new Int16Array(length);
  
  for (let i = 0; i < length; i++) {
    // Interpréter les bytes comme des int16 signés
    const byte1 = buffer[i * 2];
    const byte2 = buffer[i * 2 + 1];
    pcm[i] = (byte2 << 8) | byte1;
  }
  
  return pcm;
}

/**
 * Convertit les données PCM en tableau de peaks pour les waves
 * Génère un point toutes les 300ms (0.3 secondes)
 * Chaque point entre 1 et 100 selon l'intensité audio
 */
function processAudioToPeaks(pcmData: Int16Array, duration: number): number[] {
  const peaks: number[] = [];
  
  if (pcmData.length === 0) {
    // Retourner au minimum 20 points par défaut
    const minPoints = 20;
    for (let i = 0; i < minPoints; i++) {
      peaks.push(Math.floor(Math.random() * 30) + 1);
    }
    return peaks;
  }
  
  // Calculer la sample rate basée sur la durée et la longueur du PCM
  const sampleRate = pcmData.length / duration;
  
  // Génération toutes les 300ms (0.3 secondes)
  const intervalSeconds = 0.3;
  const samplesPerInterval = Math.max(1, Math.floor(sampleRate * intervalSeconds));
  
  // Seuil minimum pour filtrer les bruits parasites (2% de 32767)
  const noiseThreshold = 655;
  
  // Extraire les pics à chaque intervalle de 300ms
  for (let i = 0; i < pcmData.length; i += samplesPerInterval) {
    const endIndex = Math.min(i + samplesPerInterval, pcmData.length);
    
    let maxIntensity = 0;
    for (let j = i; j < endIndex; j++) {
      maxIntensity = Math.max(maxIntensity, Math.abs(pcmData[j]));
    }
    
    // Filtrer les bruits parasites et normaliser sur 1-100
    // Si intensité < seuil, on la met à 1
    let normalized;
    if (maxIntensity < noiseThreshold) {
      normalized = 1;
    } else {
      // Normaliser seulement à partir du seuil de bruit
      const adjustedIntensity = maxIntensity - noiseThreshold;
      const maxAdjusted = 32767 - noiseThreshold;
      normalized = Math.max(1, Math.round((adjustedIntensity / maxAdjusted) * 100));
    }
    
    peaks.push(normalized);
  }
  
  return peaks;
}

/**
 * Génère un tableau de waves par défaut en cas d'erreur
 */
function generateDefaultWaves(duration: number): AudioWaves {
  const numPoints = Math.max(20, Math.min(100, Math.ceil(duration * 10)));
  const waves: number[] = [];
  
  // Générer une forme d'onde lissée
  for (let i = 0; i < numPoints; i++) {
    const progress = i / numPoints;
    // Créer une courbe en forme de cloche avec variation
    const bellCurve = Math.sin(progress * Math.PI) * 50 + 50;
    const variation = Math.sin(i * 0.5) * 10;
    const value = Math.max(1, Math.min(100, Math.round(bellCurve + variation)));
    waves.push(value);
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
