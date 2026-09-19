import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { RouteWaypoint, DispatchRecord } from '../types';
import { URBAN_BUS_ROUTE } from '../../server/visionData';
import { MapPin, Navigation } from 'lucide-react';

interface LiveRouteMapProps {
  currentWaypoint: RouteWaypoint | null;
  dispatches: DispatchRecord[];
  onSelectDispatch: (dispatch: DispatchRecord) => void;
}

export const LiveRouteMap: React.FC<LiveRouteMapProps> = ({
  currentWaypoint,
  dispatches,
  onSelectDispatch
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const busMarkerRef = useRef<L.Marker | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const initialLat = currentWaypoint?.lat || 18.5300;
    const initialLng = currentWaypoint?.lng || 73.8700;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 13,
      zoomControl: true
    });

    // High clarity CartoDB Positron / Voyager light tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
      maxZoom: 19
    }).addTo(map);

    // Draw route corridor polyline
    const routeCoords: [number, number][] = URBAN_BUS_ROUTE.map(w => [w.lat, w.lng]);
    L.polyline(routeCoords, {
      color: '#2563eb',
      weight: 4,
      opacity: 0.85,
      dashArray: '6, 6'
    }).addTo(map);

    // Add Bus Marker with custom HTML icon
    const busIcon = L.divIcon({
      className: 'custom-bus-marker',
      html: `
        <div style="background-color: #1d4ed8; width: 34px; height: 34px; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px;">
          🚌
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });

    const busMarker = L.marker([initialLat, initialLng], { icon: busIcon }).addTo(map);
    busMarker.bindPopup(`
      <div style="font-family: system-ui, sans-serif; font-size: 12px;">
        <strong style="color: #1e3a8a;">EDGE-BUS-MH12-8402</strong><br/>
        Route 47B • Swargate - Viman Nagar Corridor<br/>
        <span style="color: #059669; font-weight: bold;">● Active Multi-Hazard Sensing</span>
      </div>
    `);

    busMarkerRef.current = busMarker;
    markersLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Bus Location
  useEffect(() => {
    if (!mapInstanceRef.current || !busMarkerRef.current || !currentWaypoint) return;
    busMarkerRef.current.setLatLng([currentWaypoint.lat, currentWaypoint.lng]);
  }, [currentWaypoint]);

  // Update Hazard Pins on Map
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;
    markersLayerRef.current.clearLayers();

    dispatches.slice(0, 20).forEach((record) => {
      const isAccident = record.type === 'ACCIDENT_POLICE_EMERGENCY';
      const isWaterLogged = record.severity === 'Critical Water-Logged Hazard';
      const isPothole = record.type === 'POTHOLE_MUNICIPAL_COMPLAINT';
      
      const pinColor = isAccident ? '#dc2626' : isWaterLogged ? '#0284c7' : isPothole ? '#d97706' : '#ca8a04';
      const pinIconChar = isAccident ? '🚨' : isWaterLogged ? '💧' : isPothole ? '⚠️' : '🚗';

      const pinIcon = L.divIcon({
        className: 'custom-hazard-pin',
        html: `
          <div style="background-color: ${pinColor}; width: 28px; height: 28px; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center; font-size: 12px; color: white;">
            ${pinIconChar}
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker([record.gps_lat, record.gps_lng], { icon: pinIcon });
      
      const popupHtml = `
        <div style="font-family: system-ui, sans-serif; min-width: 200px; padding: 4px;">
          <div style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">
            ${record.ward_id} • ${record.road_name}
          </div>
          <div style="font-size: 13px; font-weight: bold; color: #0f172a; margin: 2px 0;">
            ${record.title}
          </div>
          <div style="font-size: 11px; color: #334155; margin-bottom: 6px;">
            Dept: <strong>${record.department}</strong><br/>
            Status: <span style="color: ${record.delivery_status === '200_OK' ? '#16a34a' : '#d97706'}; font-weight: bold;">
              ${record.delivery_status === '200_OK' ? '200 OK Delivered' : 'Cached Offline'}
            </span>
          </div>
          <button id="btn-popup-${record.id}" style="background-color: #2563eb; color: white; border: none; border-radius: 6px; padding: 5px 10px; font-size: 11px; font-weight: bold; cursor: pointer; width: 100%;">
            View Full Docket & Evidence &rarr;
          </button>
        </div>
      `;

      marker.bindPopup(popupHtml);
      marker.on('popupopen', () => {
        const btn = document.getElementById(`btn-popup-${record.id}`);
        if (btn) {
          btn.onclick = () => {
            onSelectDispatch(record);
          };
        }
      });

      markersLayerRef.current?.addLayer(marker);
    });
  }, [dispatches, onSelectDispatch]);

  return (
    <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-sm">
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-blue-600" />
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Real-Time GPS Corridor & Anomaly Geospatial Map
          </h3>
        </div>
        <div className="text-[11px] text-slate-500 font-mono font-medium">
          Route 47B Swargate Corridor
        </div>
      </div>

      <div className="relative h-72 sm:h-80 w-full">
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        {/* Floating Map Legend (Material Card) */}
        <div className="absolute bottom-3 left-3 z-20 bg-white/95 backdrop-blur-md p-2.5 rounded-lg border border-slate-200 text-[10px] space-y-1.5 shadow-md text-slate-700">
          <div className="font-bold text-slate-900 border-b border-slate-200 pb-1">
            Map Legend
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 border border-white" />
            <span>Bus Live GPS Position</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
            <span>Water-Logged Pothole</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Bituminous Pothole</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
            <span>Traffic Jam (ITMS)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>Collision Incident (Police 112)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
