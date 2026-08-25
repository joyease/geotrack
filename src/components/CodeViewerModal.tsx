import React, { useState } from 'react';
import { ANDROID_SOURCE_FILES } from '../services/androidCodeFiles';
import { AndroidSourceFile } from '../types';
import {
  X,
  Copy,
  Check,
  FileCode,
  FolderTree,
  Download,
  Code2,
  Terminal,
  Smartphone
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const CodeViewerModal: React.FC<Props> = ({ isOpen, onClose, showToast }) => {
  const [selectedFile, setSelectedFile] = useState<AndroidSourceFile>(ANDROID_SOURCE_FILES[0]);
  const [copied, setCopied] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  if (!isOpen) return null;

  const categories = [
    { id: 'all', label: 'All Files' },
    { id: 'compose_ui', label: 'Compose UI' },
    { id: 'navigation', label: 'Navigation' },
    { id: 'data', label: 'Firestore Model' },
    { id: 'webview', label: 'Leaflet WebView' },
    { id: 'gradle_manifest', label: 'Build & Manifest' }
  ];

  const filteredFiles = activeCategory === 'all'
    ? ANDROID_SOURCE_FILES
    : ANDROID_SOURCE_FILES.filter(f => f.category === activeCategory);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    showToast(`Copied ${selectedFile.name} to clipboard`, 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadFile = () => {
    const blob = new Blob([selectedFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = selectedFile.name;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${selectedFile.name}`, 'info');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#6750A4]/20 text-[#D0BCFF] border border-[#6750A4]/30">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Android Jetpack Compose & Kotlin Project Files</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#6750A4]/40 text-[#EADDFF] border border-[#6750A4]/60">
                  Ready for Android Studio
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Production-ready Kotlin, Jetpack Compose Material 3, Firebase & Leaflet WebView source code
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Left File Tree & Right Code Viewer */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Sidebar: File Tree */}
          <div className="w-full md:w-72 border-r border-slate-800 bg-slate-950/70 flex flex-col p-3 gap-2 shrink-0">
            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-1 pb-2 border-b border-slate-800">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                    activeCategory === cat.id
                      ? 'bg-[#6750A4] text-white font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5 px-1 pt-1">
              <FolderTree className="w-3.5 h-3.5" />
              <span>Project Structure ({filteredFiles.length})</span>
            </div>

            {/* File List */}
            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {filteredFiles.map(file => {
                const isSelected = selectedFile.path === file.path;
                return (
                  <button
                    key={file.path}
                    onClick={() => setSelectedFile(file)}
                    className={`w-full text-left p-2 rounded-xl text-xs flex items-start gap-2.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#6750A4]/30 text-[#EADDFF] border border-[#6750A4]/70 shadow-sm'
                        : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    <FileCode className={`w-4 h-4 shrink-0 mt-0.5 ${isSelected ? 'text-[#D0BCFF]' : 'text-slate-500'}`} />
                    <div className="min-w-0">
                      <div className="font-medium truncate text-slate-200">{file.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono truncate">{file.path}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Area: Code Display */}
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
            {/* File Info Bar */}
            <div className="px-4 py-2.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Code2 className="w-4 h-4 text-[#D0BCFF] shrink-0" />
                <span className="font-mono text-xs font-semibold text-slate-200 truncate">
                  {selectedFile.path}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={downloadFile}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Download File"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </button>

                <button
                  onClick={copyToClipboard}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#6750A4] hover:bg-[#4F378B] text-white flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  title="Copy Full Code"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Description badge */}
            <div className="px-4 py-2 bg-slate-900/40 border-b border-slate-800/80 text-xs text-slate-400 flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>{selectedFile.description}</span>
            </div>

            {/* Code Body */}
            <div className="flex-1 overflow-auto p-4 font-mono text-xs text-slate-200 leading-relaxed bg-slate-950 select-text">
              <pre className="whitespace-pre">{selectedFile.content}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
