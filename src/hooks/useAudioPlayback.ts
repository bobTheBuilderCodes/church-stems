import { useRef, useState, useCallback, useEffect } from 'react';
import type { StemTrack } from '@/types';

export function useAudioPlayback(stems: StemTrack[], onEnded?: () => void) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodesRef = useRef<AudioBufferSourceNode[]>([]);
  const gainNodesRef = useRef<GainNode[]>([]);
  const buffersRef = useRef<AudioBuffer[]>([]);
  const startTimeRef = useRef(0);
  const pauseOffsetRef = useRef(0);
  const rafRef = useRef<number | undefined>(undefined);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const ensureContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const computeEffectiveVolume = useCallback(
    (idx: number) => {
      const anySolo = stems.some((s) => s.soloed);
      const stem = stems[idx];
      if (!stem) return 0;
      if (stem.muted) return 0;
      if (anySolo && !stem.soloed) return 0;
      return stem.volume;
    },
    [stems]
  );

  const stopSources = useCallback(() => {
    for (const src of sourceNodesRef.current) {
      try {
        src.onended = null;
        src.stop();
      } catch {
        // already stopped
      }
    }
    sourceNodesRef.current = [];
  }, []);

  const updateGains = useCallback(() => {
    for (let i = 0; i < gainNodesRef.current.length; i++) {
      const gain = computeEffectiveVolume(i);
      if (gainNodesRef.current[i]) {
        gainNodesRef.current[i].gain.setValueAtTime(gain, audioContextRef.current?.currentTime ?? 0);
      }
    }
  }, [computeEffectiveVolume]);

  const getDuration = useCallback(() => {
    if (buffersRef.current.length > 0) {
      return buffersRef.current[0].duration;
    }
    return 0;
  }, []);

  const tick = useCallback(() => {
    if (!audioContextRef.current || !isPlaying) return;
    const elapsed = audioContextRef.current.currentTime - startTimeRef.current;
    const dur = getDuration();
    const t = Math.min(elapsed, dur);
    setCurrentTime(t);
    if (elapsed >= dur) {
      setIsPlaying(false);
      pauseOffsetRef.current = 0;
      setCurrentTime(0);
      onEnded?.();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [isPlaying, getDuration, onEnded]);

  const play = useCallback(() => {
    if (buffersRef.current.length === 0) return;
    const ctx = ensureContext();
    stopSources();

    const dur = getDuration();
    const offset = Math.min(pauseOffsetRef.current, dur);
    if (offset >= dur) {
      pauseOffsetRef.current = 0;
    }

    const sources: AudioBufferSourceNode[] = [];
    const gains: GainNode[] = [];

    for (let i = 0; i < buffersRef.current.length; i++) {
      const src = ctx.createBufferSource();
      src.buffer = buffersRef.current[i];
      const gain = ctx.createGain();
      gain.gain.value = computeEffectiveVolume(i);
      src.connect(gain);
      gain.connect(ctx.destination);
      sources.push(src);
      gains.push(gain);
    }

    sourceNodesRef.current = sources;
    gainNodesRef.current = gains;

    sources[0].onended = () => {
      if (audioContextRef.current && audioContextRef.current.currentTime - startTimeRef.current >= getDuration() - 0.05) {
        setIsPlaying(false);
        pauseOffsetRef.current = 0;
        setCurrentTime(0);
        onEnded?.();
      }
    };

    startTimeRef.current = ctx.currentTime - pauseOffsetRef.current;
    for (const src of sources) {
      src.start(0, pauseOffsetRef.current);
    }

    setIsPlaying(true);
  }, [ensureContext, stopSources, computeEffectiveVolume, getDuration, onEnded]);

  const pause = useCallback(() => {
    if (!audioContextRef.current) return;
    const elapsed = audioContextRef.current.currentTime - startTimeRef.current;
    pauseOffsetRef.current = Math.min(elapsed, getDuration());
    stopSources();
    setIsPlaying(false);
  }, [stopSources, getDuration]);

  const stop = useCallback(() => {
    stopSources();
    setIsPlaying(false);
    pauseOffsetRef.current = 0;
    setCurrentTime(0);
  }, [stopSources]);

  const seek = useCallback(
    (time: number) => {
      const wasPlaying = isPlaying;
      stopSources();
      pauseOffsetRef.current = Math.max(0, Math.min(time, getDuration()));
      setCurrentTime(pauseOffsetRef.current);
      if (wasPlaying) {
        play();
      }
    },
    [isPlaying, stopSources, getDuration, play]
  );

  useEffect(() => {
    if (isPlaying) {
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, tick]);

  useEffect(() => {
    if (stems.length > 0) {
      buffersRef.current = stems.map((s) => s.buffer);
      setDuration(stems[0].buffer.duration);
    } else {
      buffersRef.current = [];
      setDuration(0);
    }
  }, [stems]);

  useEffect(() => {
    updateGains();
  }, [stems, updateGains]);

  useEffect(() => {
    return () => {
      stopSources();
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [stopSources]);

  return {
    isPlaying,
    currentTime,
    duration,
    play,
    pause,
    stop,
    seek,
  };
}
