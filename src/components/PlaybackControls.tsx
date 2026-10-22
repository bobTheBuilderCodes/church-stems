import { Play, Pause, Square, SkipBack } from 'lucide-react';
import { formatTime } from '@/lib/audio';

interface PlaybackControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (time: number) => void;
  onRestart: () => void;
}

export function PlaybackControls({
  isPlaying,
  currentTime,
  duration,
  onPlay,
  onPause,
  onStop,
  onSeek,
  onRestart,
}: PlaybackControlsProps) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(ratio * duration);
  };

  const handleTimelineKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      onSeek(Math.max(0, currentTime - 5));
    } else if (e.key === 'ArrowRight') {
      onSeek(Math.min(duration, currentTime + 5));
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      isPlaying ? onPause() : onPlay();
    }
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4 sm:p-5 shadow-sm">
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={onRestart}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-stone-600 hover:bg-stone-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Restart playback"
            title="Restart"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          {isPlaying ? (
            <button
              onClick={onPause}
              className="w-11 h-11 flex items-center justify-center rounded-full bg-stone-800 text-white hover:bg-stone-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              aria-label="Pause playback"
            >
              <Pause className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={onPlay}
              className="w-11 h-11 flex items-center justify-center rounded-full bg-stone-800 text-white hover:bg-stone-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              aria-label="Play playback"
            >
              <Play className="w-5 h-5 ml-0.5" />
            </button>
          )}
          <button
            onClick={onStop}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-stone-600 hover:bg-stone-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Stop playback"
            title="Stop"
          >
            <Square className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <div
            className="group relative h-2.5 bg-stone-200 rounded-full cursor-pointer"
            onClick={handleTimelineClick}
            onKeyDown={handleTimelineKey}
            tabIndex={0}
            role="slider"
            aria-label="Playback timeline"
            aria-valuenow={Math.round(currentTime)}
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
          >
            <div
              className="absolute top-0 left-0 h-full bg-stone-800 rounded-full transition-[width] duration-75"
              style={{ width: `${progress}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white border-2 border-stone-800 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `calc(${progress}% - 7px)` }}
            />
          </div>
        </div>

        <div className="text-sm tabular-nums text-stone-600 whitespace-nowrap font-medium">
          {formatTime(currentTime)} <span className="text-stone-400">/</span> {formatTime(duration)}
        </div>
      </div>
    </div>
  );
}
