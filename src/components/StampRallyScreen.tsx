import React, { useState, useEffect, useMemo } from 'react';
import { AuthUser, Attraction, UserStamp } from '../types';
import { NORTH_TAIWAN_100_ATTRACTIONS, calculateDistanceMeters } from '../data/attractions';
import { StorageService } from '../services/storage';
import {
  Trophy,
  Compass,
  Lock,
  CheckCircle2,
  Sparkles,
  MapPin,
  Search,
  Navigation,
  Grid,
  List,
  Star,
  X,
  Layers
} from 'lucide-react';

interface Props {
  currentUser: AuthUser;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  userStamps: UserStamp[];
  onStampUnlocked: (stamp: UserStamp) => void;
}

export const StampRallyScreen: React.FC<Props> = ({
  currentUser,
  showToast,
  userStamps,
  onStampUnlocked
}) => {
  const [selectedFilter, setSelectedFilter] = useState<'全部' | '台北市' | '新北市' | '基隆市' | '已解鎖'>('全部');
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [celebratingAttraction, setCelebratingAttraction] = useState<Attraction | null>(null);
  const [selectedAttractionDetail, setSelectedAttractionDetail] = useState<{
    attraction: Attraction;
    latRank: number;
    rowIndex: number;
    colIndex: number;
  } | null>(null);
  const [viewMode, setViewMode] = useState<'grid20x5' | 'list'>('grid20x5');

  // Simulated or real user location
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number }>({
    lat: 25.0339, // Default: Taipei 101
    lng: 121.5644
  });

  // Create a map for quick stamp lookup
  const stampsMap = useMemo(() => {
    const map = new Map<number, UserStamp>();
    userStamps.forEach(s => map.set(s.attractionId, s));
    return map;
  }, [userStamps]);

  // Attempt to get device GPS if available
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
        },
        err => {
          console.log('Using default Taipei coords:', err);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, []);

  // 100 Attractions sorted strictly by Latitude descending (緯度從大到小: 北端 -> 南端)
  const latSorted100Attractions = useMemo(() => {
    return [...NORTH_TAIWAN_100_ATTRACTIONS].sort((a, b) => {
      if (b.lat !== a.lat) {
        return b.lat - a.lat;
      }
      return a.lng - b.lng; // Secondary tie-breaker by longitude west-to-east
    });
  }, []);

  // Split into exactly 20 rows, each with 5 stamps (from left to right)
  const rowsOf5Stamps = useMemo(() => {
    const rows: {
      rowIndex: number;
      minLat: number;
      maxLat: number;
      stamps: { attraction: Attraction; latRank: number; colIndex: number }[];
    }[] = [];

    for (let r = 0; r < 20; r++) {
      const rowStamps = latSorted100Attractions.slice(r * 5, (r + 1) * 5).map((att, c) => ({
        attraction: att,
        latRank: r * 5 + c + 1,
        colIndex: c + 1
      }));

      if (rowStamps.length > 0) {
        const lats = rowStamps.map(s => s.attraction.lat);
        rows.push({
          rowIndex: r + 1,
          maxLat: Math.max(...lats),
          minLat: Math.min(...lats),
          stamps: rowStamps
        });
      }
    }
    return rows;
  }, [latSorted100Attractions]);

  const totalPoints = NORTH_TAIWAN_100_ATTRACTIONS.length; // 100
  const stampedCount = userStamps.length;
  const percentage = ((stampedCount / totalPoints) * 100).toFixed(1);

  // Filter matching check
  const checkIsMatching = (att: Attraction) => {
    if (selectedFilter === '已解鎖' && !stampsMap.has(att.id)) return false;
    if (selectedFilter === '台北市' && att.city !== '台北市') return false;
    if (selectedFilter === '新北市' && att.city !== '新北市') return false;
    if (selectedFilter === '基隆市' && att.city !== '基隆市') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        att.name.toLowerCase().includes(q) ||
        att.city.toLowerCase().includes(q) ||
        att.district.toLowerCase().includes(q)
      );
    }
    return true;
  };

  // Filtered list for detailed list mode
  const filteredAttractionsList = useMemo(() => {
    return latSorted100Attractions
      .map((att, idx) => ({
        attraction: att,
        latRank: idx + 1,
        rowIndex: Math.floor(idx / 5) + 1,
        colIndex: (idx % 5) + 1
      }))
      .filter(item => checkIsMatching(item.attraction));
  }, [latSorted100Attractions, selectedFilter, searchQuery, stampsMap]);

  // Core Real GPS Geofencing & Stamp Logic
  const handleRealGpsStamp = () => {
    if (isScanning) return;
    setIsScanning(true);

    if (!('geolocation' in navigator)) {
      showToast('請開啟定位權限以進行打卡', 'error');
      setIsScanning(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const userLat = pos.coords.latitude;
          const userLng = pos.coords.longitude;
          setUserLocation({ lat: userLat, lng: userLng });

          // Step 1: Calculate Haversine distance to all 100 attractions
          const attractionsWithDistances = NORTH_TAIWAN_100_ATTRACTIONS.map(att => {
            const dist = calculateDistanceMeters(userLat, userLng, att.lat, att.lng);
            return { attraction: att, distance: dist };
          });

          // Step 2: Check all un-unlocked attractions within 200m (0.2km)
          const unstampedWithin200m = attractionsWithDistances.filter(
            item => item.distance <= 200 && !stampsMap.has(item.attraction.id)
          );

          if (unstampedWithin200m.length > 0) {
            // Pick closest un-stamped attraction
            const closest = unstampedWithin200m.reduce((min, curr) =>
              curr.distance < min.distance ? curr : min
            );
            const targetAtt = closest.attraction;
            const todayStr = new Date().toISOString().split('T')[0];
            const newStamp: UserStamp = {
              attractionId: targetAtt.id,
              name: targetAtt.name,
              stampedAt: new Date().toISOString(),
              dateString: todayStr
            };

            await StorageService.saveUserStamp(currentUser.uid, newStamp);
            onStampUnlocked(newStamp);
            setCelebratingAttraction(targetAtt);
            showToast(`恭喜在 [${targetAtt.name}] 完成打卡！`, 'success');
          } else {
            // Check if user is within 200m of an already unlocked attraction
            const alreadyStamped = attractionsWithDistances.filter(
              item => item.distance <= 200 && stampsMap.has(item.attraction.id)
            );

            if (alreadyStamped.length > 0) {
              const att = alreadyStamped[0].attraction;
              const existing = stampsMap.get(att.id)!;
              showToast(`您在 ${existing.dateString} 已經在 [${att.name}] 完成打卡蓋章囉！`, 'info');
            } else {
              // All attractions > 200m
              showToast('目前位置附近 200 公尺內沒有可打卡的景點', 'error');
            }
          }
        } catch (err) {
          console.error('Save stamp error:', err);
          showToast('打卡處理發生錯誤，請稍後再試', 'error');
        } finally {
          setIsScanning(false);
        }
      },
      (err) => {
        console.warn('Geolocation error:', err);
        showToast('請開啟定位權限以進行打卡', 'error');
        setIsScanning(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-[#FBF8FD] overflow-y-auto pb-8">
      {/* Top Header Card */}
      <div className="p-4 space-y-4">
        {/* User Identity & Progress Dashboard Card */}
        <div
          id="stamp-dashboard-card"
          className="bg-white rounded-2xl p-4 shadow-sm border border-[#E7E0EC] space-y-3"
        >
          {/* Header Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-full bg-[#6750A4] flex items-center justify-center text-white font-bold text-xs shadow-xs">
                <Trophy className="w-4 h-4 text-amber-300" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#1D1B20] leading-tight">
                  雙北百景集章
                </h2>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-mono bg-[#EADDFF] text-[#6750A4] font-semibold border border-[#D0BCFF]">
              {currentUser.email.split('@')[0]}
            </span>
          </div>

          {/* Metrics Row: 蓋章區塊覆蓋到原本「蓋章門檻 現場半徑200M」位置 */}
          <div className="bg-[#F7F2FA] rounded-xl p-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] text-[#79747E] font-medium">已解鎖紀念印章</p>
              <p className="text-base font-extrabold text-[#6750A4] leading-tight">
                {stampedCount} <span className="text-xs font-normal text-[#49454F]">/ {totalPoints} 點</span>
              </p>
            </div>
            
            {/* GPS Scan & Stamp Button */}
            <button
              id="btn-scan-stamp"
              onClick={handleRealGpsStamp}
              disabled={isScanning}
              className="px-3.5 py-2 bg-[#6750A4] hover:bg-[#523e85] active:scale-[0.98] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-75 shrink-0"
            >
              {isScanning ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>定位比對中...</span>
                </>
              ) : (
                <>
                  <Compass className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                  <span>現場 GPS 蓋章 (200m)</span>
                </>
              )}
            </button>
          </div>

          {/* Linear Progress Bar */}
          <div className="space-y-1">
            <div className="h-2 w-full bg-[#E7E0EC] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#6750A4] to-[#B3261E] rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(2, parseFloat(percentage)))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Filter Chips, Search, & View Mode Switch */}
        <div className="space-y-2.5">
          {/* View mode toggle + City Chips */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none flex-1">
              {(['全部', '台北市', '新北市', '基隆市', '已解鎖'] as const).map(chip => {
                const active = selectedFilter === chip;
                const count =
                  chip === '全部'
                    ? totalPoints
                    : chip === '台北市'
                    ? 50
                    : chip === '新北市'
                    ? 40
                    : chip === '基隆市'
                    ? 10
                    : stampedCount;
                return (
                  <button
                    key={chip}
                    onClick={() => setSelectedFilter(chip)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                      active
                        ? 'bg-[#6750A4] text-white shadow-xs'
                        : 'bg-white text-[#49454F] border border-[#CAC4D0] hover:bg-[#F3EDF7]'
                    }`}
                  >
                    <span>{chip}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        active ? 'bg-white/25 text-white' : 'bg-[#F3EDF7] text-[#6750A4]'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-white border border-[#CAC4D0] rounded-xl p-0.5 shrink-0">
              <button
                onClick={() => setViewMode('grid20x5')}
                title="20列×5章 集章冊矩陣"
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'grid20x5'
                    ? 'bg-[#6750A4] text-white'
                    : 'text-[#49454F] hover:text-[#1D1B20]'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                title="詳細清單列表"
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-[#6750A4] text-white'
                    : 'text-[#49454F] hover:text-[#1D1B20]'
                }`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#79747E] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="搜尋景點名稱、行政區 (例: 富貴角, 101, 九份)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-[#CAC4D0] rounded-xl text-xs text-[#1D1B20] placeholder-[#79747E] focus:outline-none focus:border-[#6750A4]"
            />
          </div>
        </div>

        {/* 20 Rows x 5 Stamps Grid View (百景集章冊 - 20列每列5個章 緯度從大到小從左到右) */}
        {viewMode === 'grid20x5' ? (
          <div className="space-y-2.5">
            <div className="px-1 text-xs font-medium text-[#79747E]">
              根據緯度大小排列
            </div>

            {/* 20 Rows List */}
            <div className="space-y-2">
              {rowsOf5Stamps.map(row => {
                // Check if any stamp in this row matches filter
                const hasMatchingStamps = row.stamps.some(s => checkIsMatching(s.attraction));

                return (
                  <div
                    key={row.rowIndex}
                    className={`bg-white rounded-2xl p-2 sm:p-2.5 border transition-all shadow-xs ${
                      hasMatchingStamps
                        ? 'border-[#E7E0EC] bg-white'
                        : 'border-dashed border-[#E7E0EC]/60 opacity-40'
                    }`}
                  >
                    {/* 5 Stamps in this Row (From Left to Right) */}
                    <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                      {row.stamps.map(item => {
                        const att = item.attraction;
                        const stamp = stampsMap.get(att.id);
                        const isUnlocked = !!stamp;
                        const isMatched = checkIsMatching(att);

                        const distance = calculateDistanceMeters(
                          userLocation.lat,
                          userLocation.lng,
                          att.lat,
                          att.lng
                        );
                        const isWithin200 = distance <= 200;

                        return (
                          <div
                            key={att.id}
                            id={`grid-stamp-${att.id}`}
                            onClick={() =>
                              setSelectedAttractionDetail({
                                attraction: att,
                                latRank: item.latRank,
                                rowIndex: row.rowIndex,
                                colIndex: item.colIndex
                              })
                            }
                            className={`flex flex-col items-center justify-between p-1 sm:p-1.5 rounded-xl border transition-all cursor-pointer relative group ${
                              !isMatched
                                ? 'opacity-25 grayscale'
                                : isUnlocked
                                ? 'bg-[#FFF8F8] border-[#B3261E]/40 hover:border-[#B3261E] hover:shadow-sm'
                                : isWithin200
                                ? 'bg-[#F1F8E9] border-[#2E7D32] hover:shadow-sm ring-1 ring-[#2E7D32]'
                                : 'bg-[#FAFAFA] border-[#E7E0EC] hover:border-[#6750A4]/50 hover:bg-white'
                            }`}
                          >
                            {/* Lat rank & position chip */}
                            <div className="w-full flex items-center justify-between text-[8px] sm:text-[9px] text-[#79747E] mb-1 font-mono leading-none">
                              <span className="font-bold text-[#6750A4]">#{item.latRank}</span>
                              <span className="text-[7.5px] text-[#49454F] font-sans truncate max-w-[28px]">
                                {att.city === '台北市' ? '北市' : att.city === '新北市' ? '新北' : '基隆'}
                              </span>
                            </div>

                            {/* Stamp Seal / Locked placeholder */}
                            <div className="my-0.5 relative">
                              {isUnlocked ? (
                                /* Red Vintage Tourism Stamp (紅色觀光紀念章) */
                                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-[#B3261E] bg-[#FFF5F5] flex flex-col items-center justify-center p-0.5 shadow-2xs -rotate-3 transition-transform group-hover:scale-105">
                                  <div className="w-full h-full rounded-full border border-[#B3261E]/60 flex flex-col items-center justify-center p-0.5 text-center">
                                    <span className="text-[5.5px] sm:text-[6.5px] font-black text-[#B3261E] tracking-tighter uppercase leading-none">
                                      雙北百景
                                    </span>
                                    <span className="text-[7px] sm:text-[8px] font-black text-[#B3261E] leading-none line-clamp-1 truncate max-w-[42px] sm:max-w-[50px] my-0.5">
                                      {att.name.length > 4 ? att.name.slice(0, 3) + '…' : att.name}
                                    </span>
                                    <span className="text-[5px] sm:text-[6px] font-bold font-mono text-[#B3261E] leading-none">
                                      ★ {stamp.dateString.slice(5)} ★
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                /* Locked Stamp Slot */
                                <div
                                  className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full border border-dashed flex flex-col items-center justify-center transition-all group-hover:scale-105 ${
                                    isWithin200
                                      ? 'border-[#2E7D32] bg-[#E8F5E9] text-[#2E7D32] animate-pulse'
                                      : 'border-[#CAC4D0] bg-[#F3EDF7]/70 text-[#79747E]'
                                  }`}
                                >
                                  {isWithin200 ? (
                                    <>
                                      <Star className="w-3.5 h-3.5 text-[#2E7D32] fill-[#2E7D32]" />
                                      <span className="text-[6.5px] sm:text-[7.5px] font-bold text-[#2E7D32] mt-0.5">
                                        可蓋章
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <Lock className="w-3 h-3 text-[#79747E] mb-0.5" />
                                      <span className="text-[6.5px] sm:text-[7px] font-mono text-[#79747E] leading-none">
                                        {att.lat.toFixed(2)}°N
                                      </span>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Attraction Name snippet */}
                            <span className="text-[8px] sm:text-[9.5px] font-bold text-[#1D1B20] text-center leading-tight truncate w-full mt-1">
                              {att.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Detailed List Mode (Sorted by Latitude descending) */
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-[#49454F]">
                景點清單 (按緯度由北至南降冪排列，共 {filteredAttractionsList.length} 點)
              </span>
              <span className="text-[11px] text-[#79747E]">
                目前定位: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
              </span>
            </div>

            <div className="space-y-2">
              {filteredAttractionsList.map(item => {
                const att = item.attraction;
                const stamp = stampsMap.get(att.id);
                const isUnlocked = !!stamp;
                const distance = calculateDistanceMeters(
                  userLocation.lat,
                  userLocation.lng,
                  att.lat,
                  att.lng
                );
                const distanceStr =
                  distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${distance} m`;
                const isWithin200 = distance <= 200;

                return (
                  <div
                    key={att.id}
                    id={`attraction-card-${att.id}`}
                    onClick={() => setSelectedAttractionDetail(item)}
                    className={`bg-white rounded-xl p-3 border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                      isUnlocked
                        ? 'border-[#B3261E]/30 shadow-xs bg-[#FFFBFB]'
                        : isWithin200
                        ? 'border-[#2E7D32] bg-[#F1F8E9]'
                        : 'border-[#E7E0EC] hover:border-[#6750A4]/40 hover:bg-[#FDFBFF]'
                    }`}
                  >
                    {/* Left Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#6750A4] text-white">
                          第 {item.rowIndex} 列 · #{item.colIndex}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-[#6750A4] px-1.5 py-0.5 rounded bg-[#F3EDF7]">
                          緯度排名 #{item.latRank} ({att.lat.toFixed(4)}°N)
                        </span>
                        <span className="text-[10px] font-medium text-[#49454F] px-1.5 py-0.5 rounded bg-[#ECE6F0]">
                          {att.city} · {att.district}
                        </span>
                        {isWithin200 && !isUnlocked && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#2E7D32] text-white animate-pulse">
                            在200m範圍內
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-[#1D1B20] truncate leading-tight">
                        {att.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`text-[11px] font-semibold flex items-center gap-0.5 ${
                            isWithin200 ? 'text-[#2E7D32]' : 'text-[#79747E]'
                          }`}
                        >
                          <MapPin className="w-3 h-3" />
                          距離 {distanceStr}
                        </span>
                        <span className="text-[10px] text-[#79747E] ml-auto">
                          點擊查看詳情
                        </span>
                      </div>
                    </div>

                    {/* Right Stamp Badge */}
                    <div className="shrink-0 flex items-center justify-center">
                      {isUnlocked ? (
                        <div
                          id={`stamp-badge-${att.id}`}
                          className="w-16 h-16 rounded-full border-2 border-[#B3261E] bg-[#FFF5F5] flex flex-col items-center justify-center p-1 relative shadow-xs -rotate-6 select-none"
                        >
                          <div className="w-full h-full rounded-full border border-[#B3261E]/60 flex flex-col items-center justify-center p-0.5 text-center">
                            <span className="text-[6.5px] font-bold text-[#B3261E] tracking-tighter uppercase leading-none">
                              雙北百景
                            </span>
                            <span className="text-[8.5px] font-black text-[#B3261E] leading-tight line-clamp-1 max-w-[50px] truncate">
                              {att.name.length > 4 ? att.name.slice(0, 3) + '…' : att.name}
                            </span>
                            <div className="flex items-center justify-center gap-0.5 text-[#B3261E] leading-none my-0.5">
                              <span className="text-[5px]">★</span>
                              <span className="text-[6.5px] font-bold font-mono tracking-tighter">
                                {stamp.dateString}
                              </span>
                              <span className="text-[5px]">★</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-full border border-dashed border-[#CAC4D0] bg-[#F3EDF7] flex flex-col items-center justify-center text-[#79747E] select-none">
                          <Lock className="w-4 h-4 mb-0.5" />
                          <span className="text-[8px] font-medium">未解鎖</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Selected Stamp Interactive Modal / Inspector */}
      {selectedAttractionDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl border border-[#E7E0EC] animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-[#F3EDF7]">
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-md bg-[#6750A4] text-white text-xs font-bold">
                  第 {selectedAttractionDetail.rowIndex} 列 · 第 {selectedAttractionDetail.colIndex} 格
                </span>
                <span className="text-xs font-bold text-[#49454F]">
                  緯度排名 #{selectedAttractionDetail.latRank}
                </span>
              </div>
              <button
                onClick={() => setSelectedAttractionDetail(null)}
                className="w-7 h-7 rounded-full bg-[#F3EDF7] hover:bg-[#EADDFF] flex items-center justify-center text-[#49454F] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stamp Spotlight */}
            <div className="flex flex-col items-center justify-center py-1">
              {stampsMap.has(selectedAttractionDetail.attraction.id) ? (
                <div className="w-24 h-24 rounded-full border-3 border-[#B3261E] bg-[#FFF5F5] flex flex-col items-center justify-center p-1 shadow-md -rotate-3">
                  <div className="w-full h-full rounded-full border border-[#B3261E]/70 flex flex-col items-center justify-center p-1 text-center">
                    <span className="text-[8px] font-black text-[#B3261E] tracking-wider uppercase">
                      雙北百景紀念章
                    </span>
                    <span className="text-xs font-black text-[#B3261E] my-0.5 leading-tight">
                      {selectedAttractionDetail.attraction.name}
                    </span>
                    <span className="text-[7.5px] text-[#B3261E] font-bold">
                      {selectedAttractionDetail.attraction.city} · {selectedAttractionDetail.attraction.district}
                    </span>
                    <div className="flex items-center gap-1 text-[#B3261E] text-[7px] font-mono mt-0.5">
                      <span>★</span>
                      <span>{stampsMap.get(selectedAttractionDetail.attraction.id)!.dateString}</span>
                      <span>★</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-full border-2 border-dashed border-[#CAC4D0] bg-[#F7F2FA] flex flex-col items-center justify-center text-[#79747E]">
                  <Lock className="w-6 h-6 mb-1" />
                  <span className="text-xs font-bold">尚未解鎖</span>
                </div>
              )}
            </div>

            {/* Attraction Info Details */}
            <div className="space-y-2 bg-[#F7F2FA] rounded-2xl p-3.5 text-xs text-[#1D1B20]">
              <div className="flex justify-between items-center">
                <span className="text-[#79747E]">景點名稱</span>
                <span className="font-bold text-sm text-[#1D1B20]">
                  {selectedAttractionDetail.attraction.name}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#79747E]">所在行政區</span>
                <span className="font-semibold text-[#49454F]">
                  {selectedAttractionDetail.attraction.city} {selectedAttractionDetail.attraction.district}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#79747E]">精確地理座標</span>
                <span className="font-mono text-[#6750A4] font-semibold">
                  {selectedAttractionDetail.attraction.lat.toFixed(4)}°N, {selectedAttractionDetail.attraction.lng.toFixed(4)}°E
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#79747E]">目前距離</span>
                <span className="font-bold text-[#2E7D32]">
                  {(() => {
                    const d = calculateDistanceMeters(
                      userLocation.lat,
                      userLocation.lng,
                      selectedAttractionDetail.attraction.lat,
                      selectedAttractionDetail.attraction.lng
                    );
                    return d >= 1000 ? `${(d / 1000).toFixed(2)} 公里` : `${d} 公尺`;
                  })()}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-1">
              {stampsMap.has(selectedAttractionDetail.attraction.id) ? (
                <div className="text-center py-2 px-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-[#2E7D32] font-bold flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>已於 {stampsMap.get(selectedAttractionDetail.attraction.id)!.dateString} 成功解鎖！</span>
                </div>
              ) : (
                <div className="text-center py-2 px-3 rounded-xl bg-[#F3EDF7] border border-[#E7E0EC] text-[11px] text-[#6750A4] font-medium flex items-center justify-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>請至現場點擊上方「現場 GPS 蓋章 (200m)」完成打卡</span>
                </div>
              )}
              <button
                onClick={() => setSelectedAttractionDetail(null)}
                className="w-full py-2.5 bg-[#6750A4] hover:bg-[#523e85] text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Celebratory Dialog */}
      {celebratingAttraction && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full text-center space-y-4 shadow-2xl border border-amber-200 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6 animate-spin" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-[#1D1B20]">🎉 恭喜成功蓋章！</h3>
              <p className="text-xs text-[#49454F]">雙北百景集章 +1</p>
            </div>

            {/* Stamp Showcase */}
            <div className="py-2 flex justify-center">
              <div className="w-24 h-24 rounded-full border-3 border-[#B3261E] bg-[#FFF5F5] flex flex-col items-center justify-center p-1.5 shadow-md -rotate-3">
                <div className="w-full h-full rounded-full border border-[#B3261E]/70 flex flex-col items-center justify-center p-1">
                  <span className="text-[9px] font-black text-[#B3261E] tracking-wider uppercase">
                    雙北百景紀念章
                  </span>
                  <span className="text-xs font-black text-[#B3261E] my-0.5 leading-tight">
                    {celebratingAttraction.name}
                  </span>
                  <span className="text-[8px] text-[#B3261E] font-bold">
                    {celebratingAttraction.city} · {celebratingAttraction.district}
                  </span>
                  <div className="flex items-center gap-1 text-[#B3261E] text-[7px] font-mono mt-0.5">
                    <span>★</span>
                    <span>{new Date().toISOString().split('T')[0]}</span>
                    <span>★</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#F7F2FA] rounded-xl p-2.5 text-xs text-[#49454F]">
              目前總進度：<strong className="text-[#6750A4]">{stampedCount} / 100 點</strong> (達成率 {percentage}%)
            </div>

            <button
              onClick={() => setCelebratingAttraction(null)}
              className="w-full py-2.5 bg-[#6750A4] hover:bg-[#523e85] text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
            >
              太棒了，繼續集章！
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
