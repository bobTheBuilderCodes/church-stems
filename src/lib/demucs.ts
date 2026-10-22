import { SAMPLE_RATE, SEGMENT_SAMPLES, OVERLAP_SAMPLES, STRIDE_SAMPLES, STEM_ROW_INDEX, STEM_NAMES, type StemName } from '@/types';

export function makeTransitionWindow(seg: number, overlap: number): Float32Array {
  const w = new Float32Array(seg).fill(1);
  for (let i = 0; i < overlap; i++) {
    w[i] = i / overlap;
    w[seg - 1 - i] = i / overlap;
  }
  return w;
}

export interface SeparationResult {
  stems: Record<StemName, Float32Array[]>;
  sampleRate: number;
  length: number;
}

let ortModule: typeof import('onnxruntime-web') | null = null;

async function getOrt() {
  if (!ortModule) {
    ortModule = await import('onnxruntime-web');
    const ort = ortModule;

    ort.env.wasm.wasmPaths = '/ort-wasm/';

    const hasSharedBuffer = typeof SharedArrayBuffer !== 'undefined';
    if (hasSharedBuffer) {
      ort.env.wasm.numThreads = Math.min(navigator.hardwareConcurrency ?? 4, 4);
    } else {
      ort.env.wasm.numThreads = 1;
    }
    ort.env.wasm.simd = true;
  }
  return ortModule;
}

export async function loadModel(
  modelUrl: string,
  onProgress: (loaded: number, total: number) => void
): Promise<any> {
  const ort = await getOrt();

  const response = await fetch(modelUrl);
  if (!response.ok) {
    throw new Error(`Failed to download AI model (HTTP ${response.status}). Please check your internet connection and try again.`);
  }

  const total = Number(response.headers.get('content-length')) || 136 * 1024 * 1024;
  const reader = response.body?.getReader();
  if (!reader) {
    const buf = await response.arrayBuffer();
    return await ort.InferenceSession.create(buf, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
  }

  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.length;
      onProgress(loaded, total);
    }
  }

  const modelBuffer = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    modelBuffer.set(chunk, offset);
    offset += chunk.length;
  }

  return await ort.InferenceSession.create(modelBuffer, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  });
}

export async function separateAudio(
  session: any,
  leftChannel: Float32Array,
  rightChannel: Float32Array,
  onChunkProgress: (current: number, total: number) => void
): Promise<SeparationResult> {
  const ort = await getOrt();
  const total = leftChannel.length;
  const nChunks = Math.max(1, Math.ceil(total / STRIDE_SAMPLES));
  const window = makeTransitionWindow(SEGMENT_SAMPLES, OVERLAP_SAMPLES);

  const stemOutputs: Record<StemName, [Float32Array, Float32Array]> = {
    vocals: [new Float32Array(total), new Float32Array(total)],
    drums: [new Float32Array(total), new Float32Array(total)],
    bass: [new Float32Array(total), new Float32Array(total)],
    other: [new Float32Array(total), new Float32Array(total)],
    guitar: [new Float32Array(total), new Float32Array(total)],
    piano: [new Float32Array(total), new Float32Array(total)],
  };

  const weight = new Float32Array(total);
  const chunkBuf = new Float32Array(2 * SEGMENT_SAMPLES);

  for (let i = 0; i < nChunks; i++) {
    const start = i * STRIDE_SAMPLES;
    const end = Math.min(start + SEGMENT_SAMPLES, total);
    const chunkLen = end - start;

    chunkBuf.fill(0);
    for (let c = 0; c < 2; c++) {
      const src = c === 0 ? leftChannel : rightChannel;
      chunkBuf.subarray(c * SEGMENT_SAMPLES, c * SEGMENT_SAMPLES + chunkLen).set(
        src.subarray(start, end)
      );
    }

    const result = await session.run({
      mix: new ort.Tensor('float32', chunkBuf, [1, 2, SEGMENT_SAMPLES]),
    });

    const stemsData = result.stems.data as Float32Array;

    for (const stemName of STEM_NAMES) {
      const rowIndex = STEM_ROW_INDEX[stemName];
      const rowOffset = (rowIndex * 2) * SEGMENT_SAMPLES;
      for (let c = 0; c < 2; c++) {
        for (let s = 0; s < chunkLen; s++) {
          stemOutputs[stemName][c][start + s] +=
            stemsData[rowOffset + c * SEGMENT_SAMPLES + s] * window[s];
        }
      }
    }

    for (let s = 0; s < chunkLen; s++) {
      weight[start + s] += window[s];
    }

    onChunkProgress(i + 1, nChunks);

    if (i < nChunks - 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  for (const stemName of STEM_NAMES) {
    for (let c = 0; c < 2; c++) {
      for (let s = 0; s < total; s++) {
        stemOutputs[stemName][c][s] /= Math.max(weight[s], 1e-8);
      }
    }
  }

  return {
    stems: stemOutputs,
    sampleRate: SAMPLE_RATE,
    length: total,
  };
}
