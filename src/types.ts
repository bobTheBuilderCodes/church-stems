export type StemName = 'vocals' | 'drums' | 'bass' | 'other' | 'guitar' | 'piano';

export interface StemTrack {
  name: StemName;
  label: string;
  buffer: AudioBuffer;
  muted: boolean;
  soloed: boolean;
  volume: number;
}

export type ProcessingStage =
  | 'idle'
  | 'loading-model'
  | 'preparing-audio'
  | 'separating'
  | 'preparing-tracks'
  | 'complete'
  | 'error';

export interface ProcessingState {
  stage: ProcessingStage;
  progress: number;
  message: string;
  error: string | null;
}

export interface FileInfo {
  name: string;
  size: number;
  duration: number;
  type: string;
}

export const STEM_NAMES: StemName[] = ['vocals', 'drums', 'bass', 'other', 'guitar', 'piano'];

export const STEM_LABELS: Record<StemName, string> = {
  vocals: 'Vocals',
  drums: 'Drums',
  bass: 'Bass',
  other: 'Other',
  guitar: 'Guitar',
  piano: 'Piano',
};

export const STEM_ROW_INDEX: Record<StemName, number> = {
  drums: 0,
  bass: 1,
  other: 2,
  vocals: 3,
  guitar: 4,
  piano: 5,
};

export const SUPPORTED_FORMATS = ['.wav', '.mp3', '.flac', '.ogg', '.m4a'];
export const ACCEPTED_MIME_TYPES = 'audio/wav,audio/mpeg,audio/mp3,audio/flac,audio/ogg,audio/m4a,audio/x-m4a,audio/mp4,.wav,.mp3,.flac,.ogg,.m4a';

export const MODEL_URL = 'https://huggingface.co/StemSplitio/htdemucs-6s-onnx/resolve/main/htdemucs_6s_fp16weights.onnx';
export const MODEL_SIZE_MB = 136;

export const SAMPLE_RATE = 44100;
export const SEGMENT_SAMPLES = Math.round(7.8 * SAMPLE_RATE);
export const OVERLAP_SAMPLES = Math.floor(SEGMENT_SAMPLES / 4);
export const STRIDE_SAMPLES = SEGMENT_SAMPLES - OVERLAP_SAMPLES;
