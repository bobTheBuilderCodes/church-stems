import { Mic, Drum, Guitar, Piano, Music, AudioWaveform, Volume2, VolumeX, Headphones, Download } from 'lucide-react';
import type { StemName, StemTrack } from '@/types';
import { STEM_LABELS } from '@/types';
import { formatTime } from '@/lib/audio';
import { downloadBlob, encodeWAV, audioBufferToChannels, sanitizeFileName } from '@/lib/audio';

interface StemTrackControlsProps {
  track: StemTrack;
  songName: string;
  onToggleMute: (name: StemName) => void;
  onToggleSolo: (name: StemName) => void;
  onVolumeChange: (name: StemName, volume: number) => void;
  onDownload: (name: StemName) => void;
}

const STEM_ICONS: Record<StemName, React.ComponentType<{ className?: string }>> = {
  vocals: Mic,
  drums: Drum,
  bass: AudioWaveform,
  other: Music,
  guitar: Guitar,
  piano: Piano,
};

const STEM_COLORS: Record<StemName, { bg: string; text: string; border: string; activeBg: string }> = {
  vocals: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', activeBg: 'bg-rose-600' },
  drums: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', activeBg: 'bg-amber-600' },
  bass: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', activeBg: 'bg-blue-600' },
  other: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', activeBg: 'bg-teal-600' },
  guitar: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', activeBg: 'bg-violet-600' },
  piano: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', activeBg: 'bg-slate-700' },
};

export function StemTrackControls({
  track,
  songName,
  onToggleMute,
  onToggleSolo,
  onVolumeChange,
  onDownload,
}: StemTrackControlsProps) {
  const Icon = STEM_ICONS[track.name];
  const colors = STEM_COLORS[track.name];

  const handleDownload = () => {
    const channels = audioBufferToChannels(track.buffer);
    const blob = encodeWAV(channels, track.buffer.sampleRate);
    downloadBlob(blob, `${sanitizeFileName(songName)}-${track.name}.wav`);
    onDownload(track.name);
  };

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border ${colors.border} ${colors.bg} transition-opacity ${track.muted ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-3 min-w-0 sm:w-44">
        <div className={`w-9 h-9 flex items-center justify-center rounded-lg ${colors.activeBg} text-white flex-shrink-0`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        <div className="min-w-0">
          <div className={`text-sm font-semibold ${colors.text} truncate`}>{STEM_LABELS[track.name]}</div>
          <div className="text-xs text-stone-500 tabular-nums">{formatTime(track.buffer.duration)}</div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => onToggleMute(track.name)}
          className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            track.muted
              ? 'bg-red-600 text-white'
              : 'bg-white text-stone-500 hover:bg-stone-100 border border-stone-200'
          }`}
          aria-label={`${track.muted ? 'Unmute' : 'Mute'} ${STEM_LABELS[track.name]}`}
          aria-pressed={track.muted}
          title="Mute"
        >
          {track.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <button
          onClick={() => onToggleSolo(track.name)}
          className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            track.soloed
              ? 'bg-amber-500 text-white'
              : 'bg-white text-stone-500 hover:bg-stone-100 border border-stone-200'
          }`}
          aria-label={`${track.soloed ? 'Unsolo' : 'Solo'} ${STEM_LABELS[track.name]}`}
          aria-pressed={track.soloed}
          title="Solo"
        >
          <Headphones className="w-4 h-4" />
        </button>
        <button
          onClick={handleDownload}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-500 bg-white hover:bg-stone-100 border border-stone-200 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label={`Download ${STEM_LABELS[track.name]} stem`}
          title="Download stem"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 flex items-center gap-3 min-w-0">
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(track.volume * 100)}
          onChange={(e) => onVolumeChange(track.name, Number(e.target.value) / 100)}
          className="flex-1 h-1.5 bg-stone-200 rounded-full appearance-none cursor-pointer accent-stone-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label={`${STEM_LABELS[track.name]} volume`}
        />
        <div className="text-xs tabular-nums text-stone-500 w-9 text-right font-medium">
          {Math.round(track.volume * 100)}
        </div>
      </div>
    </div>
  );
}
