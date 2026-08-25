import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { CheckInRecord } from '../types';
import { StorageService } from '../services/storage';
import {
  Search,
  Mail,
  MapPin,
  Layers,
  RotateCcw,
  Sparkles,
  Route
} from 'lucide-react';

interface Props {
  initialEmail?: string;
  initialTripCode?: string;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const SupervisorMapScreen: React.FC<Props> = ({
  initialEmail = '',
  initialTripCode = '',
  showToast
}) => {
  const [searchEmail, setSearchEmail] = useState(initialEmail);
  const [searchTripCode, setSearchTripCode] = useState(initialTripCode);
  const [isSearching, setIsSearching] = useState(false);
  const [matchedRecords, setMatchedRecords] = useState<CheckInRecord[]>([]);
  const [tileLayerType, setTileLayerType] = useState<'osm' | 'clean' | 'satellite'>('clean');

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const polylineLayerRef = useRef<L.LayerGroup | null>(null);
  const currentTileLayerRef = useRef<L.TileLayer | null>(null);

  // Sync initial props if updated externally (e.g. from "View on Map" button in Check-in screen)
  useEffect(() => {
    if (initialEmail) setSearchEmail(initialEmail);
    if (initialTripCode) setSearchTripCode(initialTripCode);
  }, [initialEmail, initialTripCode]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // already initialized

    // Default center on Taipei / LA
    const map = L.map(mapContainerRef.current, {
      center: [25.033964, 121.564468],
      zoom: 13,
      zoomControl: false // custom position
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const tileUrls = {
      osm: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      clean: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    };

    const tileLayer = L.tileLayer(tileUrls.clean, {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors & CARTO'
    }).addTo(map);

    currentTileLayerRef.current = tileLayer;

    const markersGroup = L.layerGroup().addTo(map);
    const polylineGroup = L.layerGroup().addTo(map);

    markersLayerRef.current = markersGroup;
    polylineLayerRef.current = polylineGroup;
    mapInstanceRef.current = map;

    // Initial search load
    handleSearch(searchEmail, searchTripCode, false);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update tile layer if changed
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (currentTileLayerRef.current) {
      map.removeLayer(currentTileLayerRef.current);
    }

    const tileUrls = {
      osm: {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attr: '&copy; OpenStreetMap'
      },
      clean: {
        url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        attr: '&copy; CARTO Voyager'
      },
      satellite: {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attr: '&copy; Esri World Imagery'
      }
    };

    const config = tileUrls[tileLayerType];
    const newLayer = L.tileLayer(config.url, {
      maxZoom: 19,
      attribution: config.attr
    }).addTo(map);

    currentTileLayerRef.current = newLayer;
  }, [tileLayerType]);

  // Create custom Sleek Interface styled Leaflet marker icon
  const createCustomMarkerIcon = (index: number, total: number) => {
    const isFirst = index === 0;
    const isLast = index === total - 1 && total > 1;
    const bgColor = isLast ? '#B3261E' : isFirst ? '#059669' : '#6750A4';
    const ringColor = isLast ? '#F9DEDC' : isFirst ? '#D1FAE5' : '#EADDFF';

    return L.divIcon({
      className: 'custom-leaflet-marker',
      html: `
        <div style="transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center;">
          <div style="background-color: ${bgColor}; color: #ffffff; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 11px; box-shadow: 0 4px 10px rgba(0,0,0,0.25); border: 2.5px solid ${ringColor}; font-family: Roboto, sans-serif;">
            ${index + 1}
          </div>
          <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 6px solid ${bgColor}; margin-top: -1px;"></div>
        </div>
      `,
      iconSize: [28, 34],
      iconAnchor: [14, 34],
      popupAnchor: [0, -34]
    });
  };

  const renderMarkersOnMap = (records: CheckInRecord[]) => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    const polylineLayer = polylineLayerRef.current;

    if (!map || !markersLayer || !polylineLayer) return;

    markersLayer.clearLayers();
    polylineLayer.clearLayers();

    if (records.length === 0) return;

    const latLngs: L.LatLngExpression[] = [];

    records.forEach((record, idx) => {
      const lat = record.location.latitude;
      const lng = record.location.longitude;
      const point: [number, number] = [lat, lng];
      latLngs.push(point);

      const customIcon = createCustomMarkerIcon(idx, records.length);
      const marker = L.marker(point, { icon: customIcon }).addTo(markersLayer);

      const date = new Date(record.timestamp);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const formattedTime = `${year}/${month}/${day} ${hours}:${minutes}`;
      const username = record.userEmail ? record.userEmail.split('@')[0] : 'user';

      const popupHtml = `
        <div class="px-2 py-1 text-center font-bold text-xs text-[#1C1B1F] whitespace-nowrap" style="text-shadow: 0 1px 3px rgba(255,255,255,0.9), 0 0 6px rgba(255,255,255,0.9), 0 0 2px rgba(255,255,255,1);">
          <div class="text-[#1C1B1F] font-bold text-xs">${username}</div>
          <div class="text-[11px] font-semibold text-[#49454F]">${formattedTime}</div>
        </div>
      `;

      marker.bindPopup(popupHtml, { className: 'custom-popup' });

      // Automatically open the latest stop popup
      if (idx === records.length - 1) {
        marker.openPopup();
      }
    });

    // Draw route polyline if multiple check-in points exist
    if (latLngs.length > 1) {
      L.polyline(latLngs, {
        color: '#6750A4',
        weight: 4,
        opacity: 0.85,
        dashArray: '6, 6'
      }).addTo(polylineLayer);
    }

    // Auto-zoom & fit bounds to display all points
    try {
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16, animate: true });
    } catch (e) {
      console.warn('fitBounds error', e);
    }
  };

  const handleSearch = async (emailQuery: string, tripQuery: string, userInitiated = true) => {
    setIsSearching(true);

    try {
      // 1. Try querying live Firestore directly first
      const liveFirestoreResults = await StorageService.queryFirestoreLive(emailQuery, tripQuery);
      
      // 2. Also get local results to merge seamlessly
      const localResults = StorageService.searchCheckIns(emailQuery, tripQuery);

      // Combine results uniquely by ID or timestamp
      const combinedMap = new Map<string, CheckInRecord>();
      localResults.forEach(r => combinedMap.set(r.id, r));
      liveFirestoreResults.forEach(r => combinedMap.set(r.id, r));
      
      const cleanTrip = tripQuery.trim().toLowerCase();
      const cleanEmail = emailQuery.trim().toLowerCase();

      const results = Array.from(combinedMap.values()).filter(record => {
        const matchEmail = !cleanEmail || record.userEmail.toLowerCase().includes(cleanEmail);
        const matchTrip = !cleanTrip || record.tripCode.toLowerCase().includes(cleanTrip);
        return matchEmail && matchTrip;
      }).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      setIsSearching(false);
      setMatchedRecords(results);

      if (results.length === 0) {
        if (userInitiated) {
          showToast('查無符合此條件的打卡紀錄', 'error');
        }
        if (markersLayerRef.current) markersLayerRef.current.clearLayers();
        if (polylineLayerRef.current) polylineLayerRef.current.clearLayers();
      } else {
        renderMarkersOnMap(results);
        if (userInitiated) {
          showToast(`已於地圖標示 ${results.length} 筆打卡點`, 'success');
        }
      }
    } catch {
      setIsSearching(false);
      const results = StorageService.searchCheckIns(emailQuery, tripQuery);
      setMatchedRecords(results);
      if (results.length > 0) {
        renderMarkersOnMap(results);
      }
    }
  };

  const executeSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    handleSearch(searchEmail, searchTripCode, true);
  };

  const applyPreset = (email: string, trip: string) => {
    setSearchEmail(email);
    setSearchTripCode(trip);
    handleSearch(email, trip, true);
  };

  const resetMapBounds = () => {
    if (matchedRecords.length > 0 && mapInstanceRef.current) {
      const bounds = L.latLngBounds(
        matchedRecords.map(r => [r.location.latitude, r.location.longitude])
      );
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], animate: true });
      showToast('Centered map on markers', 'info');
    }
  };

  return (
    <div id="screen-supervisor-map" className="flex-1 flex flex-col relative overflow-hidden bg-[#CAD2D3] text-[#1C1B1F]">
      {/* Top Search Controls */}
      <div className="z-20 bg-white border-b border-[#E7E0EC] p-3 shadow-xs space-y-2">
        {/* Title */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight text-[#1C1B1F]">打卡地圖</h1>
        </div>

        <form onSubmit={executeSearch} className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {/* User Email Field */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[#79747E]">
                <Mail className="w-3.5 h-3.5" />
              </div>
              <input
                id="search-input-email"
                type="text"
                value={searchEmail}
                onChange={e => setSearchEmail(e.target.value)}
                placeholder="User Email"
                className="w-full bg-white border border-[#79747E] focus:border-[#6750A4] focus:ring-1 focus:ring-[#6750A4] rounded-lg pl-8 pr-2 py-2 text-xs text-[#1C1B1F] placeholder-[#79747E]/70 outline-none"
              />
            </div>

            {/* Trip Code Field */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[#79747E]">
                <MapPin className="w-3.5 h-3.5" />
              </div>
              <input
                id="search-input-tripcode"
                type="text"
                value={searchTripCode}
                onChange={e => setSearchTripCode(e.target.value.toUpperCase())}
                placeholder="Trip Code"
                className="w-full bg-white border border-[#79747E] focus:border-[#6750A4] focus:ring-1 focus:ring-[#6750A4] rounded-lg pl-8 pr-2 py-2 text-xs text-[#1C1B1F] font-mono uppercase placeholder-[#79747E]/70 outline-none"
              />
            </div>
          </div>

          {/* Search Button */}
          <button
            id="btn-search-map"
            type="submit"
            disabled={isSearching}
            className="w-full bg-[#6750A4] hover:bg-[#4F378B] active:bg-[#381E72] text-white font-bold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs m3-ripple cursor-pointer tracking-wide"
          >
            {isSearching ? (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Search className="w-3.5 h-3.5" />
                <span>查詢打卡路線</span>
              </>
            )}
          </button>
        </form>

        {/* Demo Preset Guide */}
        <div className="flex items-center justify-between text-[11px] pt-0.5 text-[#49454F]">
          <button
            type="button"
            onClick={() => applyPreset('hermanntalk@gmail.com', 'TAIPEI')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F7F2FA] hover:bg-[#EADDFF] text-[#6750A4] border border-[#E7E0EC] font-medium cursor-pointer transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#6750A4] shrink-0" />
            <span>輸入 hermanntalk@gmail.com 與 TAIPEI 看示範</span>
          </button>
        </div>
      </div>

      {/* Embedded Leaflet Map Container */}
      <div className="flex-1 w-full h-full relative">
        <div ref={mapContainerRef} id="leaflet-map-webview" className="w-full h-full" />

        {/* Floating Map Controls overlay */}
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5">
          {/* Layer switcher */}
          <div className="bg-white/95 backdrop-blur-md border border-[#E7E0EC] rounded-xl p-1 shadow-md flex flex-col gap-1">
            <button
              onClick={() => setTileLayerType('clean')}
              className={`p-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                tileLayerType === 'clean'
                  ? 'bg-[#6750A4] text-white font-bold'
                  : 'text-[#49454F] hover:bg-[#F7F2FA]'
              }`}
              title="Carto Clean"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="text-[10px] hidden sm:inline">Clean</span>
            </button>
            <button
              onClick={() => setTileLayerType('osm')}
              className={`p-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                tileLayerType === 'osm'
                  ? 'bg-[#6750A4] text-white font-bold'
                  : 'text-[#49454F] hover:bg-[#F7F2FA]'
              }`}
              title="OpenStreetMap Standard"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="text-[10px] hidden sm:inline">OSM</span>
            </button>
            <button
              onClick={() => setTileLayerType('satellite')}
              className={`p-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                tileLayerType === 'satellite'
                  ? 'bg-[#6750A4] text-white font-bold'
                  : 'text-[#49454F] hover:bg-[#F7F2FA]'
              }`}
              title="Satellite Imagery"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="text-[10px] hidden sm:inline">Sat</span>
            </button>
          </div>

          {/* Reset Zoom / Center */}
          <button
            onClick={resetMapBounds}
            disabled={matchedRecords.length === 0}
            className="p-2 rounded-xl bg-white/95 hover:bg-[#EADDFF] active:bg-[#D0BCFF] backdrop-blur-md border border-[#E7E0EC] text-[#49454F] hover:text-[#6750A4] shadow-md disabled:opacity-40 transition-all cursor-pointer"
            title="Fit markers to screen"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Bottom Floating Map Info Bar (Right-aligned trip & count) */}
        <div className="absolute bottom-3 right-3 z-20 pointer-events-none">
          <div className="pointer-events-auto bg-white/95 backdrop-blur-md border border-[#E7E0EC] rounded-xl px-3 py-1.5 text-xs flex items-center gap-2 text-[#1C1B1F] shadow-md font-mono">
            {matchedRecords.length > 0 ? (
              <span className="font-semibold text-[#6750A4]">
                ({matchedRecords[0].tripCode}) {matchedRecords.length} 筆
              </span>
            ) : (
              <span className="text-[#79747E]">0 筆</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

