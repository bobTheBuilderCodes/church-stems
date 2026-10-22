import { Download, Package, RotateCcw } from 'lucide-react';
import type { StemTrack, StemName } from '@/types';
import { STEM_NAMES } from '@/types';
import { encodeWAV, downloadBlob, audioBufferToChannels, sanitizeFileName, mixStems } from '@/lib/audio';
import { useState } from 'react';

interface ExportControlsProps {
  stems: StemTrack[];
  songName: string;
  onReset: () => void;
}

export function ExportControls({ stems, songName, onReset }: ExportControlsProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExportMix = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      await new Promise((r) => setTimeout(r, 50));
      const stemData = stems.map((s) => ({
        channels: audioBufferToChannels(s.buffer),
        name: s.name,
        muted: s.muted,
        soloed: s.soloed,
        volume: s.volume,
      }));
      const mixed = mixStems(stemData, stems[0].buffer.sampleRate);
      const blob = encodeWAV(mixed, stems[0].buffer.sampleRate);
      downloadBlob(blob, `${sanitizeFileName(songName)}-mix.wav`);
    } catch (err) {
      setExportError('Could not export the mix. The song may be too long for available memory.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadAll = async () => {
    setIsZipping(true);
    setExportError(null);
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      const baseName = sanitizeFileName(songName);
      for (const stem of stems) {
        const channels = audioBufferToChannels(stem.buffer);
        const blob = encodeWAV(channels, stem.buffer.sampleRate);
        const arrayBuffer = await blob.arrayBuffer();
        zip.file(`${baseName}-${stem.name}.wav`, arrayBuffer);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(zipBlob, `${baseName}-stems.zip`);
    } catch (err) {
      setExportError('Could not create ZIP archive. There may not be enough memory.');
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleExportMix}
          disabled={isExporting || isZipping}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-stone-800 text-white font-semibold text-sm hover:bg-stone-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          <Download className="w-4 h-4" />
          {isExporting ? 'Exporting...' : 'Export mix'}
        </button>
        <button
          onClick={handleDownloadAll}
          disabled={isExporting || isZipping}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white border border-stone-300 text-stone-700 font-semibold text-sm hover:bg-stone-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          <Package className="w-4 h-4" />
          {isZipping ? 'Creating ZIP...' : 'Download all stems'}
        </button>
      </div>

      <button
        onClick={onReset}
        disabled={isExporting || isZipping}
        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-stone-500 hover:text-stone-700 hover:bg-stone-100 font-medium text-sm transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <RotateCcw className="w-4 h-4" />
        Start over
      </button>

      {exportError && (
        <div className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">
          {exportError}
        </div>
      )}
    </div>
  );
}
