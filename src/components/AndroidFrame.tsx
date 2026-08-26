import React, { useState } from 'react';
import { Maximize2, Minimize2, MapPin } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  onOpenCodeViewer?: () => void;
}

export const AndroidFrame: React.FC<Props> = ({ children }) => {
  const [isPhoneFrame, setIsPhoneFrame] = useState(true);

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-[#1C1B1F] flex flex-col font-sans select-none overflow-x-hidden">
      {/* Top Header Bar */}
      <header className="h-14 bg-white border-b border-[#E0E2EC] flex items-center justify-between px-4 sm:px-8 shrink-0 z-30 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#6750A4] rounded-lg flex items-center justify-center text-white shadow-sm">
            <MapPin className="w-5 h-5" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-lg tracking-tight text-[#6750A4]">MySportsPal</span>
            <span className="hidden sm:inline text-xs text-[#79747E] font-medium">
              旅遊打卡 & 百景集章
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsPhoneFrame(!isPhoneFrame)}
            className="px-3 py-1.5 rounded-xl bg-[#F7F2FA] hover:bg-[#EADDFF] border border-[#E7E0EC] text-[#49454F] hover:text-[#6750A4] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title="切換檢視模式"
          >
            {isPhoneFrame ? (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">寬螢幕檢視</span>
              </>
            ) : (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">手機檢視</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Arena */}
      <main className="flex-1 p-2 sm:p-6 flex items-center justify-center">
        {/* Clean Container without Phone Bezel or Status Bar */}
        <div
          className={`w-full transition-all duration-300 flex flex-col bg-white text-[#1C1B1F] shadow-sm rounded-2xl overflow-hidden ${
            isPhoneFrame
              ? 'max-w-[430px] h-[820px] max-h-[92vh]'
              : 'max-w-4xl h-[86vh]'
          }`}
        >
          {/* Screen Body */}
          <div className="flex-1 flex flex-col overflow-hidden relative bg-white">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

