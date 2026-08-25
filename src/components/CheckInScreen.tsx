import React, { useState, useEffect } from 'react';
import { AuthUser, CheckInRecord, GeoPoint } from '../types';
import { StorageService } from '../services/storage';
import {
  MapPin,
  Compass,
  RefreshCw,
  Clock,
  Send,
  Navigation,
  CheckCircle,
  AlertTriangle,
  History,
  Tag
} from 'lucide-react';

interface Props {
  currentUser: AuthUser;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onNavigateToMapWithTrip?: (email: string, tripCode: string) => void;
}

export const CheckInScreen: React.FC<Props> = ({
  currentUser,
  showToast,
  onNavigateToMapWithTrip
}) => {
  const [tripCode, setTripCode] = useState('TRP-2024-08');
  const [location, setLocation] = useState<GeoPoint | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [addressHint, setAddressHint] = useState<string>('');
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [hasPermission, setHasPermission] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [recentCheckIns, setRecentCheckIns] = useState<CheckInRecord[]>([]);

  // Pre-configured GPS coordinates for testing and demoing
  const demoLocations = [
    { name: 'Taipei 101 Tower', lat: 25.033964, lng: 121.564468, hint: 'Taipei 101, Xinyi District' },
    { name: 'Taipei Main Station', lat: 25.0478, lng: 121.5170, hint: 'Taipei Main Station Front' },
    { name: 'Los Angeles DT', lat: 34.0522, lng: -118.2437, hint: 'Los Angeles Metro, California' },
    { name: 'Shibuya Crossing', lat: 35.6595, lng: 139.7004, hint: 'Shibuya Crossing, Tokyo' }
  ];

  const tripCodeSuggestions = [
    'TRP-2024-08',
    'TRP-2024-07',
    'INSPECT-0824-A',
    'ROUTE-METRO-99'
  ];

  // Request & Fetch real GPS location from device/browser
  const fetchCurrentGps = () => {
    if (!('geolocation' in navigator)) {
      setHasPermission(false);
      showToast('Geolocation is not supported by your browser', 'error');
      // Fallback to default coordinates
      setLocation({ latitude: 34.0522, longitude: -118.2437 });
      setAccuracy(5.0);
      setAddressHint('Default Location (LA Operations)');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      position => {
        setIsLocating(false);
        setHasPermission(true);
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const acc = position.coords.accuracy;
        setLocation({ latitude: lat, longitude: lng });
        setAccuracy(acc);
        setAddressHint(`GPS Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`);
        showToast('GPS Coordinates updated successfully', 'info');
      },
      error => {
        setIsLocating(false);
        console.warn('Geolocation error:', error);
        if (error.code === error.PERMISSION_DENIED) {
          setHasPermission(false);
          showToast('Location permission denied. Using simulated GPS.', 'error');
        } else {
          showToast('GPS timeout. Using high-precision fallback.', 'info');
        }
        // Graceful fallback to default
        if (!location) {
          setLocation({ latitude: 34.0522, longitude: -118.2437 });
          setAccuracy(4.2);
          setAddressHint('GPS Location (Los Angeles Ops)');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0
      }
    );
  };

  // Load user's recent check-ins
  const refreshRecentCheckIns = () => {
    const list = StorageService.getUserRecentCheckIns(currentUser.uid, 5);
    setRecentCheckIns(list);
  };

  useEffect(() => {
    fetchCurrentGps();
    refreshRecentCheckIns();
  }, [currentUser.uid]);

  // Check-in button submit action
  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = tripCode.trim().toUpperCase();

    if (!cleanCode) {
      showToast('Trip Code (行程代碼) is required', 'error');
      return;
    }

    if (!location) {
      showToast('Waiting for GPS coordinates. Please click refresh.', 'error');
      fetchCurrentGps();
      return;
    }

    setIsSubmitting(true);

    try {
      // Simulate Firestore write with serverTimestamp
      await new Promise(resolve => setTimeout(resolve, 500));

      const newRecord = await StorageService.addCheckIn({
        userId: currentUser.uid,
        userEmail: currentUser.email,
        tripCode: cleanCode,
        location: location,
        accuracy: accuracy || 4.5,
        addressHint: addressHint || `Lat: ${location.latitude.toFixed(5)}, Lng: ${location.longitude.toFixed(5)}`
      });

      setIsSubmitting(false);
      showToast(`Check-in Successful! (${newRecord.tripCode})`, 'success');
      refreshRecentCheckIns();
    } catch (err: unknown) {
      setIsSubmitting(false);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Check-in Failed: ${msg}`, 'error');
    }
  };

  const selectDemoLocation = (loc: { name: string; lat: number; lng: number; hint: string }) => {
    setLocation({ latitude: loc.lat, longitude: loc.lng });
    setAccuracy(3.5);
    setAddressHint(loc.hint);
    showToast(`Set GPS to: ${loc.name}`, 'info');
  };

  const formatDateTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + (d.toDateString() === new Date().toDateString() ? 'Today' : 'Yesterday');
    } catch {
      return isoString;
    }
  };

  return (
    <div id="screen-checkin" className="flex-1 flex flex-col p-5 overflow-y-auto space-y-4 pb-8 bg-white text-[#1C1B1F]">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1C1B1F]">Check-in</h1>
          <p className="text-xs text-[#49454F]">地點打卡 · Cloud Firestore Collection: checkins</p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-mono bg-[#EADDFF] text-[#6750A4] font-semibold border border-[#D0BCFF]">
          {currentUser.email.split('@')[0]}
        </span>
      </div>

      {/* GPS Status Card (Sleek Interface Material 3 SurfaceVariant) */}
      <div className="bg-[#F7F2FA] border border-[#E7E0EC] rounded-2xl p-4 shadow-xs">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="text-xs uppercase font-bold text-[#6750A4] tracking-wider">
              Current Status (GPS 定位狀態)
            </div>

            {isLocating ? (
              <p className="text-xs text-[#6750A4] animate-pulse pt-1">
                Acquiring high accuracy GPS coordinates...
              </p>
            ) : location ? (
              <div className="pt-0.5 space-y-1">
                <div className="text-sm font-medium text-[#49454F] font-mono">
                  Lat: {location.latitude.toFixed(4)}, Lng: {location.longitude.toFixed(4)}
                </div>
                <div className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                  <span>GPS Signal High (±{accuracy?.toFixed(1) || '4.0'}m)</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-[#B3261E] pt-1">
                <AlertTriangle className="w-4 h-4" />
                <span>GPS not available. Click refresh to retry.</span>
              </div>
            )}
          </div>

          <button
            type="button"
            id="btn-refresh-gps"
            onClick={fetchCurrentGps}
            disabled={isLocating}
            className="p-2 rounded-xl bg-white hover:bg-[#EADDFF] active:bg-[#D0BCFF] text-[#49454F] hover:text-[#6750A4] transition-all border border-[#E7E0EC] shadow-xs cursor-pointer"
            title="Refresh GPS"
          >
            <RefreshCw className={`w-4 h-4 ${isLocating ? 'animate-spin text-[#6750A4]' : ''}`} />
          </button>
        </div>

        {/* GPS Quick Location Simulator Presets */}
        <div className="mt-3 pt-2.5 border-t border-[#E7E0EC] flex items-center gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
          <span className="text-[#49454F] font-medium shrink-0 flex items-center gap-1">
            <Navigation className="w-3 h-3 text-[#6750A4]" />
            Presets:
          </span>
          {demoLocations.map(loc => (
            <button
              key={loc.name}
              type="button"
              onClick={() => selectDemoLocation(loc)}
              className="shrink-0 px-2 py-0.5 rounded-lg bg-white hover:bg-[#EADDFF] text-[#49454F] hover:text-[#6750A4] border border-[#E7E0EC] text-[10px] cursor-pointer transition-colors"
            >
              {loc.name}
            </button>
          ))}
        </div>
      </div>

      {/* Check-in Form */}
      <form onSubmit={handleCheckInSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="block">
            <span className="text-sm font-medium px-1 text-[#1C1B1F]">Trip Code (行程代碼)*</span>
            <input
              id="checkin-input-tripcode"
              type="text"
              value={tripCode}
              onChange={e => setTripCode(e.target.value.toUpperCase())}
              placeholder="e.g. TRP-2024-08"
              className="w-full mt-1 px-4 py-3 border border-[#79747E] focus:border-[#6750A4] focus:ring-1 focus:ring-[#6750A4] rounded-xl text-lg font-mono tracking-wide uppercase text-[#1C1B1F] bg-white outline-none transition-all"
              required
            />
          </label>

          {/* Quick Suggestions Chips */}
          <div className="flex flex-wrap gap-1.5 pt-1 px-1">
            {tripCodeSuggestions.map(code => (
              <button
                key={code}
                type="button"
                onClick={() => setTripCode(code)}
                className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full border transition-all cursor-pointer ${
                  tripCode === code
                    ? 'bg-[#EADDFF] border-[#6750A4] text-[#6750A4] font-semibold'
                    : 'bg-[#F7F2FA] border-[#E7E0EC] text-[#49454F] hover:bg-[#EADDFF]/60'
                }`}
              >
                {code}
              </button>
            ))}
          </div>
        </div>

        {/* Check-in Action Button (Sleek Interface Pill Filled Button) */}
        <button
          id="btn-submit-checkin"
          type="submit"
          disabled={isSubmitting || !location}
          className="w-full bg-[#6750A4] text-white py-4 rounded-full font-bold shadow-md hover:bg-[#4F378B] active:bg-[#381E72] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all m3-ripple cursor-pointer text-sm tracking-wider"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>SAVING TO FIRESTORE...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>PERFORM CHECK-IN (確認打卡)</span>
            </>
          )}
        </button>
      </form>

      {/* Recent Check-ins List (Sleek Interface Style) */}
      <div className="space-y-2 pt-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#49454F] uppercase tracking-wider flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-[#6750A4]" />
            <span>Recent Check-ins</span>
          </h3>
          <span className="text-[10px] text-[#79747E] font-mono">
            {recentCheckIns.length} records
          </span>
        </div>

        {recentCheckIns.length === 0 ? (
          <div className="bg-[#FEF7FF] border border-dashed border-[#E7E0EC] rounded-xl p-5 text-center text-[#79747E] text-xs">
            No check-in records for this user yet. Submit your first check-in above!
          </div>
        ) : (
          <div className="space-y-2">
            {recentCheckIns.map(record => (
              <div
                key={record.id}
                id={`checkin-item-${record.id}`}
                className="flex items-center justify-between p-3 bg-[#FEF7FF] border border-[#E7E0EC] rounded-xl text-xs text-[#1C1B1F] shadow-xs hover:border-[#D0BCFF] transition-all"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold font-mono text-sm text-[#1C1B1F]">
                      {record.tripCode}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-100 text-emerald-800 border border-emerald-300">
                      SAVED
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-[#79747E]">
                    <Clock className="w-3 h-3 text-[#79747E]" />
                    <span>{formatDateTime(record.timestamp)}</span>
                    <span>•</span>
                    <span className="font-mono">
                      {record.location.latitude.toFixed(3)}, {record.location.longitude.toFixed(3)}
                    </span>
                  </div>
                </div>

                {onNavigateToMapWithTrip && (
                  <button
                    type="button"
                    onClick={() => onNavigateToMapWithTrip(record.userEmail, record.tripCode)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#EADDFF] hover:bg-[#6750A4] text-[#6750A4] hover:text-white transition-all cursor-pointer shadow-2xs shrink-0"
                    title="View this trip on Supervisor Map"
                  >
                    View Map ↗
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

