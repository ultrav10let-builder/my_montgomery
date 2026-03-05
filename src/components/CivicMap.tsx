import React, { useState } from 'react';
import { Map as MapIcon } from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Popup, GeoJSON } from 'react-leaflet';
import { CivicSignal } from '../types';
import { format } from 'date-fns';
import { safeFormat } from '../utils/dateUtils';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import neighborhoodData from '../data/montgomery.json';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CivicMapProps {
  signals: CivicSignal[];
}

export function CivicMap({ signals }: CivicMapProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredSignals = selectedCategory 
    ? signals.filter(s => s.category === selectedCategory)
    : signals;

  const getHeatColor = (score: number) => {
    if (score > 80) return '#ef4444'; // Red
    if (score > 50) return '#f59e0b'; // Amber
    return '#10b981'; // Green
  };

  return (
    <section className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[500px]">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapIcon className="w-5 h-5 text-civic-blue" />
          <h2 className="font-semibold">Resource Allocation Map</h2>
        </div>
        <div className="flex gap-2">
          {["All", "Infrastructure", "Sanitation", "Public Safety"].map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat === "All" ? null : cat)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-all",
                (selectedCategory === cat || (cat === "All" && !selectedCategory))
                  ? "bg-civic-blue text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 relative">
        <MapContainer center={[32.3668, -86.3000]} zoom={12} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* Neighborhood Polygons */}
          <GeoJSON 
            data={neighborhoodData as any}
            style={(feature) => ({
              fillColor: getHeatColor(feature?.properties.signalScore || 0),
              weight: 1,
              opacity: 1,
              color: 'white',
              fillOpacity: 0.2
            })}
          />

          {filteredSignals.map(signal => {
            if (signal.lat === null || signal.lng === null) return null;
            return (
              <CircleMarker 
                key={signal.id}
                center={[signal.lat, signal.lng]}
                radius={8}
                pathOptions={{
                  fillColor: getCategoryColor(signal.category),
                  color: "white",
                  weight: 2,
                  fillOpacity: 0.8
                }}
              >
                <Popup>
                  <div className="p-1">
                    <p className="text-xs font-bold uppercase text-slate-400 mb-1">{signal.category}</p>
                    <p className="font-semibold text-slate-900">{signal.neighborhood || "Unknown"}</p>
                    <p className="text-xs text-slate-500 mt-1">{safeFormat(signal.opened_at, 'MMM d, yyyy')}</p>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </section>
  );
}

function getCategoryColor(category: string) {
  switch (category) {
    case 'Infrastructure': return '#3b82f6';
    case 'Sanitation': return '#10b981';
    case 'Public Safety': return '#ef4444';
    case 'Parks': return '#84cc16';
    default: return '#64748b';
  }
}
