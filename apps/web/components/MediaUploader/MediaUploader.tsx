import React, { useRef } from 'react';
import { FileAudio, Image as ImageIcon, X } from 'lucide-react';

interface MediaUploaderProps {
  label: string;
  accept: string;
  type: 'image' | 'voice';
  file: File | null;
  onFileSelect: (file: File | null) => void;
}

export const MediaUploader: React.FC<MediaUploaderProps> = ({
  label,
  accept,
  type,
  file,
  onFileSelect,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="flex flex-col space-y-2">
      <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </label>
      {!file ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className="group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-800 bg-gray-900/40 p-6 text-center transition-all duration-200 hover:border-blue-500/50 hover:bg-gray-900/80"
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                onFileSelect(e.target.files[0]);
              }
            }}
            className="hidden"
          />
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-400 transition-transform duration-200 group-hover:scale-110">
            {type === 'image' ? (
              <ImageIcon className="h-6 w-6" />
            ) : (
              <FileAudio className="h-6 w-6" />
            )}
          </div>
          <p className="text-sm font-medium text-gray-300">
            Click to upload or drag & drop {type}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {type === 'image' ? 'PNG, JPG up to 20MB' : 'WAV, MP3, M4A up to 50MB'}
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
          <div className="flex items-center space-x-3 truncate">
            {type === 'image' ? (
              <ImageIcon className="h-5 w-5 flex-shrink-0 text-blue-400" />
            ) : (
              <FileAudio className="h-5 w-5 flex-shrink-0 text-blue-400" />
            )}
            <div className="truncate">
              <p className="truncate text-sm font-medium text-white">{file.name}</p>
              <p className="text-xs text-gray-400">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onFileSelect(null)}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-500/20 hover:text-red-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};
