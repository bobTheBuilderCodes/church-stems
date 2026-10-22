import type { StemName } from '@/types';
import { SAMPLE_RATE } from '@/types';

export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export async function decodeAudioFile(file: File, audioContext: AudioContext): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
  return decoded;
}

export function resampleTo441(buffer: AudioBuffer, targetCtx: AudioContext): Float32Array[] {
  if (buffer.sampleRate === SAMPLE_RATE) {
    const left = buffer.getChannelData(0);
    const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
    return [new Float32Array(left), new Float32Array(right)];
  }

  const ratio = SAMPLE_RATE / buffer.sampleRate;
  const newLength = Math.round(buffer.length * ratio);
  const leftInput = buffer.getChannelData(0);
  const rightInput = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : leftInput;

  const leftOutput = new Float32Array(newLength);
  const rightOutput = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const srcIdx = i / ratio;
    const idx0 = Math.floor(srcIdx);
    const idx1 = Math.min(idx0 + 1, leftInput.length - 1);
    const frac = srcIdx - idx0;
    leftOutput[i] = leftInput[idx0] * (1 - frac) + leftInput[idx1] * frac;
    rightOutput[i] = rightInput[idx0] * (1 - frac) + rightInput[idx1] * frac;
  }

  return [leftOutput, rightOutput];
}

export function createAudioBufferFromChannels(
  channels: Float32Array[],
  sampleRate: number,
  audioContext: AudioContext
): AudioBuffer {
  const numChannels = channels.length;
  const length = channels[0].length;
  const buffer = audioContext.createBuffer(numChannels, length, sampleRate);
  for (let c = 0; c < numChannels; c++) {
    buffer.copyToChannel(channels[c], c);
  }
  return buffer;
}

export function encodeWAV(channels: Float32Array[], sampleRate: number): Blob {
  const numChannels = channels.length;
  const length = channels[0].length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = length * blockAlign;
  const bufferSize = 44 + dataSize;

  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export function mixStems(
  stemBuffers: { channels: Float32Array[]; name: StemName; muted: boolean; soloed: boolean; volume: number }[],
  sampleRate: number
): Float32Array[] {
  const anySolo = stemBuffers.some((s) => s.soloed);
  const length = stemBuffers[0].channels[0].length;
  const numChannels = stemBuffers[0].channels.length;
  const output: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    output.push(new Float32Array(length));
  }

  for (const stem of stemBuffers) {
    if (stem.muted) continue;
    if (anySolo && !stem.soloed) continue;
    if (!anySolo && stem.soloed) continue;

    const vol = stem.volume;
    for (let c = 0; c < numChannels; c++) {
      const src = stem.channels[c];
      const dst = output[c];
      for (let i = 0; i < length; i++) {
        dst[i] += src[i] * vol;
      }
    }
  }

  let maxSample = 0;
  for (let c = 0; c < numChannels; c++) {
    for (let i = 0; i < length; i++) {
      const abs = Math.abs(output[c][i]);
      if (abs > maxSample) maxSample = abs;
    }
  }

  if (maxSample > 1.0) {
    const normFactor = 0.99 / maxSample;
    for (let c = 0; c < numChannels; c++) {
      for (let i = 0; i < length; i++) {
        output[c][i] *= normFactor;
      }
    }
  }

  return output;
}

export function sanitizeFileName(name: string): string {
  return name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function audioBufferToChannels(buffer: AudioBuffer): Float32Array[] {
  const channels: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    channels.push(new Float32Array(buffer.getChannelData(c)));
  }
  return channels;
}
