import { Loader2, Download, Cpu, Music, Scissors, AudioWaveform, CheckCircle2 } from 'lucide-react';
import type { ProcessingStage } from '@/types';
import { MODEL_SIZE_MB } from '@/types';

interface ProcessingPanelProps {
  stage: ProcessingStage;
  progress: number;
  message: string;
  onCancel: () => void;
}

const STAGE_CONFIG: { stage: ProcessingStage; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { stage: 'loading-model', label: 'Loading AI model', icon: Cpu },
  { stage: 'preparing-audio', label: 'Preparing audio', icon: Music },
  { stage: 'separating', label: 'Separating stems', icon: Scissors },
  { stage: 'preparing-tracks', label: 'Preparing audio tracks', icon: AudioWaveform },
];

export function ProcessingPanel({ stage, progress, message, onCancel }: ProcessingPanelProps) {
  const currentStageIndex = STAGE_CONFIG.findIndex((s) => s.stage === stage);
  const isIndeterminate = stage === 'preparing-audio' || stage === 'preparing-tracks';

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 sm:p-8 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <Loader2 className="w-6 h-6 text-stone-600 animate-spin" />
        <div>
          <div className="text-base font-semibold text-stone-800">Processing your song</div>
          <div className="text-sm text-stone-500">{message}</div>
        </div>
      </div>

      <div className="space-y-4">
        {STAGE_CONFIG.map((config, index) => {
          const Icon = config.icon;
          const isComplete = index < currentStageIndex;
          const isActive = index === currentStageIndex;
          const isPending = index > currentStageIndex;

          return (
            <div key={config.stage} className="flex items-center gap-3">
              <div className={`w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 transition-colors ${
                isComplete ? 'bg-green-100 text-green-600' :
                isActive ? 'bg-stone-800 text-white' :
                'bg-stone-100 text-stone-400'
              }`}>
                {isComplete ? (
                  <CheckCircle2 className="w-4.5 h-4.5" />
                ) : isActive ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>
              <div className="flex-1">
                <div className={`text-sm font-medium transition-colors ${
                  isPending ? 'text-stone-400' : 'text-stone-700'
                }`}>
                  {config.label}
                </div>
                {isActive && stage === 'loading-model' && progress > 0 && (
                  <div className="mt-1.5">
                    <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-stone-800 rounded-full transition-[width] duration-200"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="text-xs text-stone-500 mt-1 tabular-nums">
                      {progress.toFixed(0)}% of {MODEL_SIZE_MB} MB
                    </div>
                  </div>
                )}
                {isActive && stage === 'separating' && progress > 0 && (
                  <div className="mt-1.5">
                    <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-stone-800 rounded-full transition-[width] duration-200"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="text-xs text-stone-500 mt-1 tabular-nums">
                      Chunk {Math.round((progress / 100) * 100)}% processed
                    </div>
                  </div>
                )}
                {isActive && isIndeterminate && (
                  <div className="mt-1.5">
                    <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
                      <div className="h-full w-1/3 bg-stone-800 rounded-full animate-pulse" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={onCancel}
        className="mt-6 text-sm text-stone-500 hover:text-stone-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg px-3 py-1.5"
      >
        Cancel
      </button>

      {stage === 'loading-model' && (
        <div className="mt-4 flex items-start gap-2 text-xs text-stone-400 bg-stone-50 rounded-lg p-3">
          <Download className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            The AI model ({MODEL_SIZE_MB} MB) downloads once and is cached by your browser.
            After the first download, it loads from cache on subsequent uses.
          </span>
        </div>
      )}
    </div>
  );
}
