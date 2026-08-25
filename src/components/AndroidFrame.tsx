import React, { useState, useEffect } from 'react';
import { Wifi, Battery, Signal, Maximize2, Minimize2, Code2, MapPin } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  onOpenCodeViewer: () => void;
}

export const AndroidFrame: React.FC<Props> = ({ children, onOpenCodeViewer }) => {
  const [time, setTime] = useState('10:42');
  const [isPhoneFrame, setIsPhoneFrame] = useState(true);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-[#1C1B1F] flex flex-col font-sans select-none overflow-x-hidden">
      {/* Sleek Interface Top Navigation Header */}
      <header className="h-16 bg-white border-b border-[#E0E2EC] flex items-center justify-between px-4 sm:px-8 shrink-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#6750A4] rounded-lg flex items-center justify-center text-white shadow-sm">
            <MapPin className="w-5 h-5" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-xl tracking-tight text-[#6750A4]">GeoTrack Pro</span>
            <span className="hidden sm:inline text-xs text-[#79747E] font-medium font-mono">
              Material 3 · Kotlin + Leaflet
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden md:inline text-xs font-medium text-[#49454F] px-2.5 py-1 bg-[#F7F2FA] rounded-full border border-[#E7E0EC]">
            Supervisor Overview
          </span>

          <button
            onClick={() => setIsPhoneFrame(!isPhoneFrame)}
            className="px-3 py-1.5 rounded-xl bg-[#F7F2FA] hover:bg-[#EADDFF] border border-[#E7E0EC] text-[#49454F] hover:text-[#6750A4] text-xs font-medium flex items-center gap-1.5 transition-colors"
            title="Toggle Device Frame"
          >
            {isPhoneFrame ? (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Expanded View</span>
              </>
            ) : (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Phone Frame</span>
              </>
            )}
          </button>

          <button
            onClick={onOpenCodeViewer}
            className="px-3.5 py-1.5 rounded-xl bg-[#6750A4] hover:bg-[#4F378B] active:bg-[#381E72] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all m3-ripple"
            title="View Kotlin & Jetpack Compose Source Code"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Android Code (.kt)</span>
          </button>
        </div>
      </header>

      {/* Main Content Arena */}
      <main className="flex-1 p-2 sm:p-6 md:p-8 flex items-center justify-center">
        {/* Device Frame or Full Screen */}
        <div
          className={`w-full transition-all duration-300 flex flex-col bg-white text-[#1C1B1F] ${
            isPhoneFrame
              ? 'max-w-[420px] h-[850px] max-h-[92vh] rounded-[40px] border-[8px] border-[#1C1B1F] shadow-2xl relative overflow-hidden'
              : 'max-w-4xl h-[88vh] rounded-3xl border border-[#E0E2EC] shadow-xl relative overflow-hidden'
          }`}
        >
          {/* Top Notch / Camera Indicator */}
          {isPhoneFrame && (
            <div className="h-6 w-full flex justify-center items-center pt-2 bg-white z-40 select-none">
              <div className="w-20 h-3.5 bg-[#1C1B1F] rounded-full shadow-inner" />
            </div>
          )}

          {/* Android Status Bar */}
          <div className="w-full bg-white px-6 py-1.5 flex items-center justify-between text-xs font-mono text-[#49454F] select-none z-40 border-b border-[#F3EDF7]">
            <span className="font-semibold tracking-wide text-[11px] text-[#1C1B1F]">{time}</span>

            <div className="flex items-center gap-2 text-[#49454F]">
              <Signal className="w-3.5 h-3.5 text-[#6750A4]" />
              <span className="text-[10px] font-bold text-[#6750A4]">5G</span>
              <Wifi className="w-3.5 h-3.5" />
              <Battery className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Screen Body */}
          <div className="flex-1 flex flex-col overflow-hidden relative bg-white">
            {children}
          </div>

          {/* Android Bottom Gesture Navigation Bar */}
          <div className="w-full bg-white py-1 flex items-center justify-center z-40 select-none">
            <div className="w-28 h-1 bg-[#1C1B1F]/25 rounded-full" />
          </div>
        </div>
      </main>
    </div>
  );
};

