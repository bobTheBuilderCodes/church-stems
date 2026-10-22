import { useRef, useState, useCallback } from 'react';
import { UploadCloud, FileAudio, X, Loader2 } from 'lucide-react';
import type { FileInfo } from '@/types';
import { SUPPORTED_FORMATS, ACCEPTED_MIME_TYPES } from '@/types';
import { formatFileSize, formatTime } from '@/lib/audio';

interface UploadZoneProps {
  fileInfo: FileInfo | null;
  isLoading: boolean;
  duration: number | null;
  onFileSelected: (file: File) => void;
  onRemoveFile: () => void;
  error: string | null;
}

export function UploadZone({
  fileInfo,
  isLoading,
  duration,
  onFileSelected,
  onRemoveFile,
  error,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onFileSelected(file);
    },
    [onFileSelected]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
    e.target.value = '';
  };

  if (fileInfo) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-4 sm:p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 flex items-center justify-center rounded-lg bg-stone-100 text-stone-600 flex-shrink-0">
            <FileAudio className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-stone-800 truncate">{fileInfo.name}</div>
            <div className="text-xs text-stone-500 mt-0.5">
              {formatFileSize(fileInfo.size)}
              {duration != null && ` · ${formatTime(duration)}`}
            </div>
          </div>
          {!isLoading && (
            <button
              onClick={onRemoveFile}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Remove file"
              title="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {isLoading && (
            <Loader2 className="w-5 h-5 text-stone-400 animate-spin flex-shrink-0" />
          )}
        </div>
        {error && (
          <div className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        tabIndex={0}
        role="button"
        aria-label="Upload audio file"
        className={`relative flex flex-col items-center justify-center gap-3 p-8 sm:p-12 rounded-xl border-2 border-dashed cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-stone-300 bg-white hover:border-stone-400 hover:bg-stone-50'
        }`}
      >
        <div className={`w-14 h-14 flex items-center justify-center rounded-full transition-colors ${
          isDragging ? 'bg-blue-100 text-blue-600' : 'bg-stone-100 text-stone-500'
        }`}>
          <UploadCloud className="w-7 h-7" />
        </div>
        <div className="text-center">
          <div className="text-base font-semibold text-stone-700">
            {isDragging ? 'Drop your audio file here' : 'Drag and drop your song here'}
          </div>
          <div className="text-sm text-stone-500 mt-1">
            or <span className="text-blue-600 font-medium underline">browse files</span>
          </div>
        </div>
        <div className="text-xs text-stone-400 mt-1">
          Supports {SUPPORTED_FORMATS.join(', ').toUpperCase()}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_MIME_TYPES}
        onChange={handleChange}
        className="hidden"
      />
      {error && (
        <div className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">
          {error}
        </div>
      )}
    </div>
  );
}
