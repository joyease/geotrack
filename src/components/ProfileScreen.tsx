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
  Database,
  Download,
  FileSpreadsheet
} from 'lucide-react';

interface Props {
  currentUser: AuthUser;
  onLogout: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onViewTripOnMap?: (tripCode: string) => void;
  userStampsCount?: number;
  onNavigateToStamps?: () => void;
}

export const ProfileScreen: React.FC<Props> = ({
  currentUser,
  onLogout,
  showToast,
  onViewTripOnMap,
  userStampsCount = 0,
  onNavigateToStamps
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
    onLogout();
  };

  const [isExporting, setIsExporting] = useState(false);

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      // 1. Fetch records (prefer live Firestore query, fallback to local storage)
      let allRecords = await StorageService.queryFirestoreLive();
      if (!allRecords || allRecords.length === 0) {
        allRecords = StorageService.getAllCheckIns();
      }

      // 2. Filter last 30 days
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const filtered = allRecords.filter(r => new Date(r.timestamp).getTime() >= thirtyDaysAgo);

      // 3. Format CSV rows (Email, GPS, Time, TripCode, Device)
      const rows = [
        ['Email', 'GPS_Latitude', 'GPS_Longitude', 'GPS_Coordinates', 'Time', 'TripCode', 'DeviceModel']
      ];

      filtered.forEach(r => {
        const lat = r.location?.latitude?.toFixed(6) ?? '';
        const lng = r.location?.longitude?.toFixed(6) ?? '';
        const coords = r.location ? `"${lat}, ${lng}"` : '';
        const timeStr = r.timestamp ? `"${new Date(r.timestamp).toLocaleString('zh-TW', { hour12: false })}"` : '';
        rows.push([
          `"${r.userEmail}"`,
          lat,
          lng,
          coords,
          timeStr,
          `"${r.tripCode}"`,
          `"${r.deviceModel || ''}"`
        ]);
      });

      const csvContent = '\uFEFF' + rows.map(e => e.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      link.setAttribute('href', url);
      link.setAttribute('download', `geotrack_30days_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast(`已成功下載過去 30 天歷史資料 (${filtered.length} 筆，Google Sheet CSV 格式)`, 'success');
    } catch (err: any) {
      showToast(`匯出失敗: ${err.message}`, 'error');
    } finally {
      setIsExporting(false);
    }
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
        <h1 className="text-2xl font-semibold tracking-tight text-[#1C1B1F]">個人中心</h1>
      </div>

      {/* User Hero Avatar Section */}
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
          <span>使用中 (UID: {currentUser.uid.substring(0, 10)})</span>
        </div>
      </div>

      {/* Usage Summary Section */}
      <div className="grid grid-cols-2 gap-3 my-2">
        <div className="bg-[#F7F2FA] border border-[#E7E0EC] rounded-2xl p-4 flex flex-col items-center text-center shadow-xs">
          <span className="text-2xl font-black text-[#6750A4] font-mono">
            {isLoading ? '...' : summary.uniqueTripCodesCount}
          </span>
          <span className="text-xs text-[#49454F] font-bold mt-1.5">獨立行程數</span>
        </div>
        <div className="bg-[#F7F2FA] border border-[#E7E0EC] rounded-2xl p-4 flex flex-col items-center text-center shadow-xs">
          <span className="text-2xl font-black text-[#6750A4] font-mono">
            {isLoading ? '...' : summary.totalCheckInsCount}
          </span>
          <span className="text-xs text-[#49454F] font-bold mt-1.5">打卡總次數</span>
        </div>
      </div>

      {/* Stamp Rally Progress Card */}
      <div className="bg-gradient-to-r from-[#FFF5F5] to-[#FEF7FF] border border-[#B3261E]/30 rounded-2xl p-4 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#B3261E] text-white flex items-center justify-center text-xs font-bold">
              ★
            </div>
            <h3 className="text-xs font-bold text-[#1D1B20]">雙北百景集章進度</h3>
          </div>
          <span className="text-xs font-bold text-[#B3261E]">
            {userStampsCount} / 100 點
          </span>
        </div>
        <div className="h-2 w-full bg-[#E7E0EC] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#6750A4] to-[#B3261E] rounded-full"
            style={{ width: `${Math.min(100, Math.max(2, (userStampsCount / 100) * 100))}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-[#49454F] pt-1">
          <span>達成率: {((userStampsCount / 100) * 100).toFixed(1)}%</span>
          {onNavigateToStamps && (
            <button
              onClick={onNavigateToStamps}
              className="text-[#6750A4] font-bold hover:underline cursor-pointer"
            >
              前往集章 →
            </button>
          )}
        </div>
      </div>

      {/* Used Trip Codes List */}
      <div className="space-y-2 bg-[#FEF7FF] border border-[#E7E0EC] rounded-2xl p-4 shadow-xs">
        <h3 className="text-xs font-bold text-[#49454F] tracking-wider flex items-center justify-between">
          <span>使用過的行程代碼</span>
          <span className="text-[10px] text-[#79747E] font-mono">{summary.tripCodes.length} 個</span>
        </h3>

        {summary.tripCodes.length === 0 ? (
          <p className="text-xs text-[#79747E] italic py-2">
            尚未建立行程代碼，請前往「定位打卡」開始。
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {summary.tripCodes.map(code => (
              <button
                key={code}
                type="button"
                onClick={() => onViewTripOnMap && onViewTripOnMap(code)}
                className="px-2.5 py-1 rounded-lg text-xs font-mono bg-white hover:bg-[#6750A4] hover:text-white border border-[#E7E0EC] text-[#6750A4] font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                title="點擊前往打卡地圖查看"
              >
                <span>{code}</span>
                <span className="text-[10px] opacity-70">↗</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 30-Day History Export (Google Sheet / CSV) Card */}
      <div className="bg-[#F3EDF7] border border-[#E7E0EC] rounded-2xl p-4 shadow-xs space-y-2.5">
        <div className="flex items-center gap-2 text-[#1C1B1F]">
          <FileSpreadsheet className="w-4 h-4 text-[#6750A4]" />
          <h3 className="text-xs font-bold">歷史資料下載 (Google Sheet 格式)</h3>
        </div>
        <p className="text-[11px] text-[#49454F] leading-relaxed">
          包含欄位：Email, GPS 經緯度, 時間 (過去30天)，支援匯出為標準 CSV 並直接在 Google 試算表或 Excel 開啟。
        </p>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={isExporting}
          className="w-full py-2.5 px-3 rounded-xl text-xs font-bold bg-[#6750A4] hover:bg-[#533f85] text-white flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isExporting ? '正在匯出中...' : '下載過去 30 天歷史紀錄 (CSV/試算表)'}</span>
        </button>
      </div>

      {/* Database Reset Option for Testers */}
      <button
        type="button"
        onClick={handleResetData}
        className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold bg-[#F7F2FA] hover:bg-[#F3EDF7] text-[#49454F] border border-[#E7E0EC] flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
      >
        <Database className="w-3.5 h-3.5 text-[#79747E]" />
        <span>重設示範打卡資料</span>
      </button>

      {/* Logout Button */}
      <button
        id="btn-logout"
        type="button"
        onClick={handleLogoutClick}
        className="w-full mt-2 bg-[#B3261E] hover:bg-[#8C1D18] active:bg-[#601410] text-white font-bold py-3 px-4 rounded-full flex items-center justify-center gap-2 transition-all shadow-md m3-ripple cursor-pointer tracking-wider text-xs"
      >
        <LogOut className="w-4 h-4" />
        <span>登出帳號</span>
      </button>
    </div>
  );
};

