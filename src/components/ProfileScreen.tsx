import React, { useState, useEffect } from 'react';
import { AuthUser } from '../types';
import { StorageService } from '../services/storage';
import {
  User,
  LogOut,
  Tag,
  Shield,
  Smartphone,
  CheckCircle2,
  Database
} from 'lucide-react';

interface Props {
  currentUser: AuthUser;
  onLogout: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onViewTripOnMap?: (tripCode: string) => void;
}

export const ProfileScreen: React.FC<Props> = ({
  currentUser,
  onLogout,
  showToast,
  onViewTripOnMap
}) => {
  const [summary, setSummary] = useState<{
    uniqueTripCodesCount: number;
    totalCheckInsCount: number;
    tripCodes: string[];
  }>({
    uniqueTripCodesCount: 0,
    totalCheckInsCount: 0,
    tripCodes: []
  });

  const [isLoading, setIsLoading] = useState(true);

  const loadUserMetrics = () => {
    setIsLoading(true);
    setTimeout(() => {
      const stats = StorageService.getUserSummary(currentUser.uid, currentUser.email);
      setSummary(stats);
      setIsLoading(false);
    }, 200);
  };

  useEffect(() => {
    loadUserMetrics();
  }, [currentUser.uid]);

  const handleLogoutClick = () => {
    StorageService.setCurrentUser(null);
    showToast('Logged out successfully', 'info');
    onLogout();
  };

  const handleResetData = () => {
    StorageService.resetDemoData();
    loadUserMetrics();
    showToast('Reset Firestore demo records to defaults', 'success');
  };

  const getInitials = (email: string) => {
    const name = email.split('@')[0];
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div id="screen-profile" className="flex-1 flex flex-col p-5 overflow-y-auto space-y-4 pb-8 bg-white text-[#1C1B1F]">
      {/* Screen Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#1C1B1F]">Profile</h1>
        <p className="text-xs text-[#49454F]">個人資料 · Firebase Authentication State</p>
      </div>

      {/* User Hero Avatar Section (Sleek Interface Style) */}
      <div className="flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-full bg-[#6750A4] text-white flex items-center justify-center text-2xl font-bold mb-3 shadow-md border-4 border-[#EADDFF]">
          {getInitials(currentUser.email)}
        </div>
        <h2 className="text-lg font-bold text-[#1C1B1F]">
          {currentUser.displayName || currentUser.email.split('@')[0]}
        </h2>
        <p className="text-xs font-mono text-[#49454F] mt-0.5">{currentUser.email}</p>
        <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#F7F2FA] border border-[#E7E0EC] text-[#6750A4]">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Active Inspector (UID: {currentUser.uid.substring(0, 10)})</span>
        </div>
      </div>

      {/* Usage Summary Section (Sleek Interface Stats Cards) */}
      <div className="grid grid-cols-2 gap-3 my-2">
        <div className="bg-[#F7F2FA] border border-[#E7E0EC] rounded-2xl p-4 flex flex-col items-center text-center shadow-xs">
          <span className="text-2xl font-black text-[#6750A4] font-mono">
            {isLoading ? '...' : summary.uniqueTripCodesCount}
          </span>
          <span className="text-[11px] text-[#49454F] font-bold uppercase mt-1">Unique Trips</span>
          <span className="text-[10px] text-[#79747E]">獨立行程代碼數</span>
        </div>
        <div className="bg-[#F7F2FA] border border-[#E7E0EC] rounded-2xl p-4 flex flex-col items-center text-center shadow-xs">
          <span className="text-2xl font-black text-[#6750A4] font-mono">
            {isLoading ? '...' : summary.totalCheckInsCount}
          </span>
          <span className="text-[11px] text-[#49454F] font-bold uppercase mt-1">Total Check-ins</span>
          <span className="text-[10px] text-[#79747E]">總打卡紀錄次數</span>
        </div>
      </div>

      {/* Used Trip Codes List */}
      <div className="space-y-2 bg-[#FEF7FF] border border-[#E7E0EC] rounded-2xl p-4 shadow-xs">
        <h3 className="text-xs font-bold text-[#49454F] uppercase tracking-wider flex items-center justify-between">
          <span>Active Trip Codes Used:</span>
          <span className="text-[10px] text-[#79747E] font-mono">{summary.tripCodes.length} codes</span>
        </h3>

        {summary.tripCodes.length === 0 ? (
          <p className="text-xs text-[#79747E] italic py-2">
            No trip codes recorded yet. Go to Check-in tab to create one.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {summary.tripCodes.map(code => (
              <button
                key={code}
                type="button"
                onClick={() => onViewTripOnMap && onViewTripOnMap(code)}
                className="px-2.5 py-1 rounded-lg text-xs font-mono bg-white hover:bg-[#6750A4] hover:text-white border border-[#E7E0EC] text-[#6750A4] font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                title="Click to view on Supervisor Map"
              >
                <span>{code}</span>
                <span className="text-[10px] opacity-70">↗</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* System & Architecture Info */}
      <div className="bg-[#F7F2FA] border border-[#E7E0EC] rounded-2xl p-4 space-y-2 text-xs text-[#49454F] shadow-xs">
        <div className="flex items-center gap-2 text-[#1C1B1F] font-bold">
          <Smartphone className="w-4 h-4 text-[#6750A4]" />
          <span>Android Architecture & Cloud Stack</span>
        </div>
        <ul className="space-y-1 text-[11px] text-[#49454F] list-disc list-inside">
          <li><strong>Auth:</strong> FirebaseAuth email & password tokens</li>
          <li><strong>Database:</strong> Cloud Firestore collection <code>checkins</code></li>
          <li><strong>Map:</strong> Leaflet.js with Carto/OSM in Android WebView</li>
          <li><strong>Location:</strong> Android FusedLocationProviderClient (GPS)</li>
        </ul>
      </div>

      {/* Database Reset Option for Testers */}
      <button
        type="button"
        onClick={handleResetData}
        className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold bg-[#F7F2FA] hover:bg-[#F3EDF7] text-[#49454F] border border-[#E7E0EC] flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
      >
        <Database className="w-3.5 h-3.5 text-[#79747E]" />
        <span>Reset Sample Check-in Data</span>
      </button>

      {/* Logout Button (Red filled pill button from Sleek Interface) */}
      <button
        id="btn-logout"
        type="button"
        onClick={handleLogoutClick}
        className="w-full mt-2 bg-[#B3261E] hover:bg-[#8C1D18] active:bg-[#601410] text-white font-bold py-3 px-4 rounded-full flex items-center justify-center gap-2 transition-all shadow-md m3-ripple cursor-pointer tracking-wider text-xs"
      >
        <LogOut className="w-4 h-4" />
        <span>LOGOUT (登出帳號)</span>
      </button>
    </div>
  );
};

