import React, { useEffect } from 'react';
import { ToastMessage } from '../types';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

interface Props {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const MaterialToastContainer: React.FC<Props> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none w-full max-w-sm px-4">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 3500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const getStyle = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-[#1C1B1F] text-[#EADDFF] border-[#6750A4]/40 shadow-xl';
      case 'error':
        return 'bg-[#B3261E] text-white border-[#8C1D18] shadow-xl';
      default:
        return 'bg-[#1C1B1F] text-white border-[#49454F] shadow-xl';
    }
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-[#D0BCFF] shrink-0" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-[#F9DEDC] shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-[#D0BCFF] shrink-0" />;
    }
  };

  return (
    <div
      id={`toast-${toast.id}`}
      className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-full border shadow-xl backdrop-blur-md text-sm font-medium transition-all duration-300 animate-in fade-in slide-in-from-bottom-3 ${getStyle()}`}
    >
      <div className="flex items-center gap-2.5">
        {getIcon()}
        <span>{toast.message}</span>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-1 hover:bg-white/10 rounded-full transition-colors"
        aria-label="Dismiss toast"
      >
        <X className="w-4 h-4 opacity-70 hover:opacity-100" />
      </button>
    </div>
  );
};
