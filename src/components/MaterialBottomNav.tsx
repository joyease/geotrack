import React from 'react';
import { NavigationTab } from '../types';
import { MapPin, Map, User } from 'lucide-react';

interface Props {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
}

export const MaterialBottomNav: React.FC<Props> = ({ activeTab, onTabChange }) => {
  const tabs: { id: NavigationTab; label: string; subLabel: string; icon: React.ReactNode }[] = [
    {
      id: 'checkin',
      label: 'Check-in',
      subLabel: '地點打卡',
      icon: <MapPin className="w-4 h-4" />
    },
    {
      id: 'map',
      label: 'Map',
      subLabel: '主管地圖',
      icon: <Map className="w-4 h-4" />
    },
    {
      id: 'profile',
      label: 'Profile',
      subLabel: '個人資料',
      icon: <User className="w-4 h-4" />
    }
  ];

  return (
    <nav
      id="android-bottom-navigation"
      className="h-16 border-t border-[#E7E0EC] flex items-center justify-around bg-[#F3EDF7] px-3 z-30 select-none shrink-0"
    >
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            id={`nav-tab-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            className="flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-all duration-200"
          >
            <div
              className={`w-14 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
                isActive
                  ? 'bg-[#EADDFF] text-[#6750A4] font-bold shadow-xs'
                  : 'text-[#49454F] hover:bg-[#EADDFF]/50 hover:text-[#1C1B1F]'
              }`}
            >
              {tab.icon}
            </div>
            <span
              className={`text-[10px] mt-0.5 tracking-tight font-medium transition-colors ${
                isActive ? 'text-[#6750A4] font-bold' : 'text-[#49454F]'
              }`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

