import { useState, useCallback, useRef, useEffect } from 'react';
import { Music4, AlertCircle, Info } from 'lucide-react';
import type { FileInfo, ProcessingState, StemTrack, StemName } from '@/types';
import { STEM_NAMES, STEM_LABELS, SUPPORTED_FORMATS, MODEL_URL, MODEL_SIZE_MB } from '@/types';
import { UploadZone } from '@/components/UploadZone';
import { ProcessingPanel } from '@/components/ProcessingPanel';
import { PlaybackControls } from '@/components/PlaybackControls';
import { StemTrackControls } from '@/components/StemTrackControls';
import { ExportControls } from '@/components/ExportControls';
import { useAudioPlayback } from '@/hooks/useAudioPlayback';
import { decodeAudioFile, resampleTo441, createAudioBufferFromChannels, formatTime } from '@/lib/audio';
import { loadModel, separateAudio } from '@/lib/demucs';

function App() {
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [stems, setStems] = useState<StemTrack[]>([]);
  const [processing, setProcessing] = useState<ProcessingState>({
    stage: 'idle',
    progress: 0,
    message: '',
    error: null,
  });
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [songName, setSongName] = useState('');
  const [showMuteSoloInfo, setShowMuteSoloInfo] = useState(false);

  const selectedFileRef = useRef<File | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const cancelRef = useRef(false);

  const playback = useAudioPlayback(stems);

  const ensureAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }, []);

  const resetStems = useCallback(() => {
    playback.stop();
    setStems([]);
  }, [playback]);

  const handleFileSelected = useCallback(
    async (file: File) => {
      setUploadError(null);

      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      const validExtensions = SUPPORTED_FORMATS;
      if (!validExtensions.includes(ext)) {
        setUploadError(`Unsupported format "${ext}". Please use ${validExtensions.join(', ').toUpperCase()}.`);
        return;
      }

      if (file.size > 200 * 1024 * 1024) {
        setUploadError('File is larger than 200 MB. For best performance in the browser, use shorter or smaller files.');
        return;
      }

      cancelRef.current = false;
      selectedFileRef.current = file;
      setSongName(file.name);

      let duration = 0;
      try {
        const ctx = ensureAudioContext();
        const buffer = await decodeAudioFile(file, ctx);
        duration = buffer.duration;
        setFileInfo({
          name: file.name,
          size: file.size,
          duration,
          type: file.type || ext,
        });
      } catch (err) {
        setUploadError('Could not read this audio file. It may be corrupt or in an unsupported format.');
        selectedFileRef.current = null;
        return;
      }
    },
    [ensureAudioContext]
  );

  const handleRemoveFile = useCallback(() => {
    selectedFileRef.current = null;
    setFileInfo(null);
    setUploadError(null);
    resetStems();
  }, [resetStems]);

  const handleSeparate = useCallback(async () => {
    const file = selectedFileRef.current;
    if (!file) return;

    cancelRef.current = false;
    setProcessing({ stage: 'loading-model', progress: 0, message: 'Downloading AI model (first time only)...', error: null });
    resetStems();

    try {
      if (!sessionRef.current) {
        sessionRef.current = await loadModel(MODEL_URL, (loaded, total) => {
          if (cancelRef.current) return;
          const pct = (loaded / total) * 100;
          setProcessing((prev) => ({
            ...prev,
            progress: pct,
            message: `Downloading AI model... ${pct.toFixed(0)}% of ${MODEL_SIZE_MB} MB`,
          }));
        });
      }

      if (cancelRef.current) return;

      setProcessing({ stage: 'preparing-audio', progress: 0, message: 'Decoding and preparing audio...', error: null });

      const ctx = ensureAudioContext();
      const audioBuffer = await decodeAudioFile(file, ctx);
      const [left, right] = resampleTo441(audioBuffer, ctx);

      if (cancelRef.current) return;

      setProcessing({ stage: 'separating', progress: 0, message: 'Separating stems...', error: null });

      const result = await separateAudio(sessionRef.current, left, right, (current, total) => {
        if (cancelRef.current) return;
        const pct = (current / total) * 100;
        setProcessing((prev) => ({
          ...prev,
          progress: pct,
          message: `Separating stems... chunk ${current} of ${total}`,
        }));
      });

      if (cancelRef.current) return;

      setProcessing({ stage: 'preparing-tracks', progress: 0, message: 'Preparing audio tracks...', error: null });

      await new Promise((r) => setTimeout(r, 50));

      const newStems: StemTrack[] = STEM_NAMES.map((name) => {
        const channels = result.stems[name];
        const buffer = createAudioBufferFromChannels(channels, result.sampleRate, ctx);
        return {
          name,
          label: STEM_LABELS[name],
          buffer,
          muted: false,
          soloed: false,
          volume: 1.0,
        };
      });

      if (cancelRef.current) return;

      setStems(newStems);
      setProcessing({ stage: 'complete', progress: 100, message: 'Separation complete!', error: null });
    } catch (err: any) {
      if (cancelRef.current) return;
      const msg = err?.message || String(err);
      let userMessage = 'An error occurred during processing.';
      if (msg.includes('Failed to download') || msg.includes('fetch')) {
        userMessage = `Could not download the AI model. Please check your internet connection and try again. (${msg})`;
      } else if (msg.includes('memory') || msg.includes('out of memory') || msg.includes('buffer') || msg.includes('bad_alloc') || msg.includes('ERROR_CODE: 6')) {
        userMessage = 'Not enough memory to load the AI model. Try a shorter song, close other browser tabs, or use a device with more RAM.';
      } else if (msg.includes('WASM') || msg.includes('WebAssembly') || msg.includes('simd')) {
        userMessage = 'Your browser does not support the required WebAssembly features. Please use a recent version of Chrome, Firefox, or Safari.';
      } else {
        userMessage = `Processing error: ${msg}`;
      }
      setProcessing({ stage: 'error', progress: 0, message: '', error: userMessage });
    }
  }, [ensureAudioContext, resetStems]);

  const handleCancel = useCallback(() => {
    cancelRef.current = true;
    setProcessing({ stage: 'idle', progress: 0, message: '', error: null });
  }, []);

  const handleReset = useCallback(() => {
    cancelRef.current = true;
    playback.stop();
    setStems([]);
    setFileInfo(null);
    setUploadError(null);
    setProcessing({ stage: 'idle', progress: 0, message: '', error: null });
    selectedFileRef.current = null;
    if (sessionRef.current) {
      try {
        sessionRef.current.release();
      } catch {
        // ignore
      }
      sessionRef.current = null;
    }
  }, [playback]);

  const toggleMute = useCallback((name: StemName) => {
    setStems((prev) => prev.map((s) => (s.name === name ? { ...s, muted: !s.muted } : s)));
  }, []);

  const toggleSolo = useCallback((name: StemName) => {
    setStems((prev) => prev.map((s) => (s.name === name ? { ...s, soloed: !s.soloed } : s)));
  }, []);

  const handleVolumeChange = useCallback((name: StemName, volume: number) => {
    setStems((prev) => prev.map((s) => (s.name === name ? { ...s, volume } : s)));
  }, []);

  const handleDownload = useCallback((_name: StemName) => {}, []);

  useEffect(() => {
    return () => {
      cancelRef.current = true;
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      if (sessionRef.current) {
        try {
          sessionRef.current.release();
        } catch {
          // ignore
        }
        sessionRef.current = null;
      }
    };
  }, []);

  const isProcessing = processing.stage !== 'idle' && processing.stage !== 'complete' && processing.stage !== 'error';
  const showMixer = stems.length > 0 && (processing.stage === 'complete' || processing.stage === 'idle');

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-stone-800 text-white">
            <Music4 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">ChurchStem</h1>
            <p className="text-sm text-stone-500">Separate songs. Practice your part.</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
        {!showMixer && !isProcessing && processing.stage !== 'error' && (
          <div className="space-y-5">
            <UploadZone
              fileInfo={fileInfo}
              isLoading={false}
              duration={fileInfo?.duration ?? null}
              onFileSelected={handleFileSelected}
              onRemoveFile={handleRemoveFile}
              error={uploadError}
            />
            {fileInfo && (
              <button
                onClick={handleSeparate}
                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-stone-800 text-white font-semibold text-base hover:bg-stone-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                Separate song
              </button>
            )}
            {!fileInfo && (
              <div className="flex items-start gap-2.5 text-sm text-stone-500 bg-blue-50 border border-blue-100 rounded-xl p-4">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" />
                <div>
                  <p className="font-medium text-stone-700 mb-1">How it works</p>
                  <p>Upload a song and the AI separates it into six stems: vocals, drums, bass, other, guitar, and piano. Everything runs locally in your browser — your audio never leaves your device.</p>
                  <p className="mt-2 text-xs">The AI model ({MODEL_SIZE_MB} MB) downloads once on first use and is cached for future sessions.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {isProcessing && (
          <ProcessingPanel
            stage={processing.stage}
            progress={processing.progress}
            message={processing.message}
            onCancel={handleCancel}
          />
        )}

        {processing.stage === 'error' && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-red-800">Processing failed</div>
                  <div className="text-sm text-red-600 mt-1">{processing.error}</div>
                </div>
              </div>
            </div>
            <button
              onClick={() => setProcessing({ stage: 'idle', progress: 0, message: '', error: null })}
              className="w-full px-4 py-3 rounded-xl bg-stone-800 text-white font-semibold text-sm hover:bg-stone-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Try again
            </button>
          </div>
        )}

        {showMixer && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-stone-800 truncate">{songName}</h2>
                <p className="text-sm text-stone-500">
                  {stems[0] ? formatTime(stems[0].buffer.duration) : ''} · 6 stems separated
                </p>
              </div>
            </div>

            <PlaybackControls
              isPlaying={playback.isPlaying}
              currentTime={playback.currentTime}
              duration={playback.duration}
              onPlay={playback.play}
              onPause={playback.pause}
              onStop={playback.stop}
              onSeek={playback.seek}
              onRestart={() => playback.seek(0)}
            />

            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-wide">Stems</h3>
              <button
                onClick={() => setShowMuteSoloInfo(!showMuteSoloInfo)}
                className="text-xs text-stone-400 hover:text-stone-600 transition-colors flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-2 py-1"
              >
                <Info className="w-3.5 h-3.5" />
                Mute / Solo rules
              </button>
            </div>

            {showMuteSoloInfo && (
              <div className="text-xs text-stone-600 bg-stone-100 rounded-lg p-3 space-y-1">
                <p><strong>Mute</strong> silences a track. Muted tracks stay silent even if soloed.</p>
                <p><strong>Solo</strong> isolates a track. When any track is soloed, only soloed (and non-muted) tracks are audible.</p>
                <p><strong>Volume</strong> affects both playback and the exported mix (0–100%, no amplification beyond original).</p>
              </div>
            )}

            <div className="space-y-2.5">
              {stems.map((track, index) => (
                <StemTrackControls
                  key={track.name}
                  track={track}
                  songName={songName}
                  index={index}
                  onToggleMute={toggleMute}
                  onToggleSolo={toggleSolo}
                  onVolumeChange={handleVolumeChange}
                  onDownload={handleDownload}
                />
              ))}
            </div>

            <ExportControls stems={stems} songName={songName} onReset={handleReset} />
          </div>
        )}
      </main>

      <footer className="border-t border-stone-200 bg-white mt-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 text-xs text-stone-400 text-center">
          ChurchStem runs entirely in your browser. Audio is never uploaded to a server.
        </div>
      </footer>
    </div>
  );
}

export default App;
