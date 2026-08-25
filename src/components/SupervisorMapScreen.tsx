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

      const dateStr = new Date(record.timestamp).toLocaleString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });

      const popupHtml = `
        <div class="p-2 space-y-1.5 min-w-[210px] text-[#1C1B1F] font-['Roboto']">
          <div class="flex items-center justify-between border-b border-[#E7E0EC] pb-1.5">
            <span class="font-bold text-xs text-[#6750A4] font-mono tracking-wider">
              ${record.tripCode}
            </span>
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-[#EADDFF] text-[#6750A4] font-bold font-mono">
              Stop #${idx + 1}
            </span>
          </div>
          <div class="text-[11px] text-[#49454F] space-y-0.5">
            <div><span class="text-[#79747E] font-medium">User:</span> <strong class="text-[#1C1B1F]">${record.userEmail}</strong></div>
            <div><span class="text-[#79747E] font-medium">Time:</span> ${dateStr}</div>
            <div class="font-mono text-[10px] text-[#79747E] pt-0.5">
              Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}
            </div>
            ${record.addressHint ? `<div class="text-[10px] text-[#79747E] truncate font-sans">${record.addressHint}</div>` : ''}
          </div>
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

  const handleSearch = (emailQuery: string, tripQuery: string, userInitiated = true) => {
    setIsSearching(true);

    setTimeout(() => {
      setIsSearching(false);
      const results = StorageService.searchCheckIns(emailQuery, tripQuery);
      setMatchedRecords(results);

      if (results.length === 0) {
        if (userInitiated) {
          showToast('No check-in records matched this query', 'error');
        }
        if (markersLayerRef.current) markersLayerRef.current.clearLayers();
        if (polylineLayerRef.current) polylineLayerRef.current.clearLayers();
      } else {
        renderMarkersOnMap(results);
        if (userInitiated) {
          showToast(`Found ${results.length} check-in points on Leaflet map`, 'success');
        }
      }
    }, 300);
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
      {/* Top Search Controls (Sleek Interface Input Bar) */}
      <div className="z-20 bg-white border-b border-[#E7E0EC] p-3 shadow-xs space-y-2">
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
                placeholder="User Email (用戶Email)"
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
                placeholder="Trip Code (行程代碼)"
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
                <span>SEARCH LOCATION (查詢打卡路線)</span>
              </>
            )}
          </button>
        </form>

        {/* Quick Filter Presets Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-[10px] pt-0.5 no-scrollbar">
          <span className="text-[#49454F] font-bold shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#6750A4]" />
            Presets:
          </span>
          <button
            type="button"
            onClick={() => applyPreset('hermanntalk@gmail.com', 'INSPECT-0824-A')}
            className="shrink-0 px-2 py-0.5 rounded-full bg-[#F7F2FA] hover:bg-[#EADDFF] text-[#49454F] hover:text-[#6750A4] border border-[#E7E0EC] font-mono cursor-pointer transition-colors"
          >
            Hermann · INSPECT-0824-A
          </button>
          <button
            type="button"
            onClick={() => applyPreset('field_agent_01@company.com', 'ROUTE-METRO-99')}
            className="shrink-0 px-2 py-0.5 rounded-full bg-[#F7F2FA] hover:bg-[#EADDFF] text-[#49454F] hover:text-[#6750A4] border border-[#E7E0EC] font-mono cursor-pointer transition-colors"
          >
            Agent 01 · ROUTE-METRO-99
          </button>
          <button
            type="button"
            onClick={() => applyPreset('', '')}
            className="shrink-0 px-2 py-0.5 rounded-full bg-[#F7F2FA] hover:bg-[#EADDFF] text-[#49454F] hover:text-[#6750A4] border border-[#E7E0EC] cursor-pointer transition-colors"
          >
            View All Records
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

        {/* Bottom Floating Map Info Bar */}
        <div className="absolute bottom-3 left-3 right-3 z-20 pointer-events-none">
          <div className="pointer-events-auto bg-white/95 backdrop-blur-md border border-[#E7E0EC] rounded-xl px-3 py-2 text-xs flex items-center justify-between text-[#1C1B1F] shadow-md">
            <div className="flex items-center gap-2">
              <Route className="w-4 h-4 text-[#6750A4] shrink-0" />
              <span className="font-bold text-[#1C1B1F]">
                {matchedRecords.length} Check-in Point{matchedRecords.length !== 1 ? 's' : ''} Plotted
              </span>
            </div>
            {matchedRecords.length > 0 ? (
              <div className="flex items-center gap-1 text-[11px] text-[#49454F] font-mono">
                <span className="font-bold text-[#6750A4]">Trip: {matchedRecords[0].tripCode}</span>
              </div>
            ) : (
              <div className="text-[10px] text-[#79747E] font-mono">Leaflet.js + OSM Tiles</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

