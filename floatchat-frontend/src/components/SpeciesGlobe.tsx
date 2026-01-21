'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';

// Dynamic import with SSR disabled to prevent hydration mismatch
const Globe = dynamic(() => import('react-globe.gl'), { ssr: false });

interface Marker {
  lat: number;
  lng: number;
  label?: string;
  color?: string;
  type?: string;
  size?: number;
  altitude?: number;
  details?: {
    date?: string;
    dataset?: string;
    institution?: string;
  };
}

interface SpeciesGlobeProps {
  markers: Marker[];
}

export default function SpeciesGlobe({ markers = [] }: SpeciesGlobeProps) {
  const globeEl = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoveredMarker, setHoveredMarker] = useState<Marker | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<Marker | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [isGlobeVisible, setIsGlobeVisible] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // 1. ROBUST RESIZING
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions((prev) => {
            if (prev.width === width && prev.height === height) return prev;
            return { width, height };
        });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // 2. Process markers
  const processedMarkers = useMemo(() => {
    if (!markers || markers.length === 0) return [];
    
    return markers.map((marker, index) => {
      let color = marker.color || '#00ffcc';
      let size = marker.size || 0.5;
      
      return {
        ...marker,
        color,
        size,
        altitude: 0.01 + (index % 5) * 0.005,
      };
    });
  }, [markers]);

  // 3. Initialize Globe Controls
  useEffect(() => {
    if (!globeEl.current) return;
    
    const controls = globeEl.current.controls();
    if (controls) {
        controls.autoRotate = autoRotate;
        controls.autoRotateSpeed = 0.5;
        controls.enableDamping = true;
        controls.dampingFactor = 0.1;
        controls.minDistance = 200;
        controls.maxDistance = 4000;
    }
  }, [autoRotate, isInitialized]);

  // 4. Auto-Center
  useEffect(() => {
    if (globeEl.current && processedMarkers.length > 0 && dimensions.width > 0) {
      const avgLat = processedMarkers.reduce((sum, m) => sum + m.lat, 0) / processedMarkers.length;
      const avgLng = processedMarkers.reduce((sum, m) => sum + m.lng, 0) / processedMarkers.length;
      
      setTimeout(() => {
        globeEl.current.pointOfView({ lat: avgLat, lng: avgLng, altitude: 2.0 }, 2000);
      }, 500);
    }
  }, [processedMarkers, dimensions]);

  // 5. Handlers
  const handleMarkerClick = useCallback((marker: Marker) => {
    setSelectedMarker(marker);
    if (globeEl.current) {
      globeEl.current.pointOfView({ lat: marker.lat, lng: marker.lng, altitude: 1.5 }, 1000);
    }
  }, []);

  const handleGlobeReady = useCallback(() => {
    setIsInitialized(true);
    setTimeout(() => setIsGlobeVisible(true), 100); 
  }, []);

  // Tooltip tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (hoveredMarker) {
        setTooltipPosition({ x: e.clientX, y: e.clientY });
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [hoveredMarker]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full relative"
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      onMouseDown={() => setIsDragging(true)}
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={() => setIsDragging(false)}
    >
      <div className="absolute top-2 left-2 z-10 text-[10px] text-slate-500 font-mono pointer-events-none">
        {processedMarkers.length} POINTS {autoRotate ? '• ROTATING' : ''}
      </div>
      
      {dimensions.width > 0 && dimensions.height > 0 && (
        <div className={`w-full h-full transition-opacity duration-700 ${isGlobeVisible ? 'opacity-100' : 'opacity-0'}`}>
            <Globe
              ref={globeEl}
              width={dimensions.width}
              height={dimensions.height}
              backgroundColor="rgba(0,0,0,0)"
              globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
              bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
              backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
              
              showAtmosphere={true}
              atmosphereColor="#3b82f6"
              atmosphereAltitude={0.15}
              
              pointsData={processedMarkers}
              pointLat="lat"
              pointLng="lng"
              pointColor="color"
              pointRadius="size"
              pointAltitude="altitude"
              pointResolution={16}
              
              // ✅ FIXED: Explicit type casting for callbacks
              onPointClick={(point) => handleMarkerClick(point as Marker)}
              onPointHover={(point) => setHoveredMarker(point as Marker | null)}
              onGlobeClick={() => setSelectedMarker(null)}
              onGlobeReady={handleGlobeReady}
            />
        </div>
      )}

      {/* Controls Overlay */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className="p-2 rounded-lg bg-slate-900/80 backdrop-blur border border-slate-700 text-slate-300 hover:text-white transition-colors"
          title="Toggle Rotation"
        >
          {autoRotate ? '⏸️' : '▶️'}
        </button>
        <button
          onClick={() => {
             if (globeEl.current) globeEl.current.pointOfView({ lat: 0, lng: 0, altitude: 2.5 }, 1000);
          }}
          className="p-2 rounded-lg bg-slate-900/80 backdrop-blur border border-slate-700 text-slate-300 hover:text-white transition-colors"
          title="Reset View"
        >
          🔄
        </button>
      </div>

      {/* Tooltip */}
      {hoveredMarker && !isDragging && (
        <div 
          className="fixed z-50 pointer-events-none bg-slate-900/95 border border-teal-500/50 rounded-lg p-3 shadow-2xl backdrop-blur-md"
          style={{ left: tooltipPosition.x + 15, top: tooltipPosition.y - 40 }}
        >
          <div className="flex items-center gap-2 mb-1">
             <div className="w-2 h-2 rounded-full" style={{ backgroundColor: hoveredMarker.color }}></div>
             <span className="text-xs font-bold text-teal-100">Observation</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            {hoveredMarker.lat.toFixed(2)}°N, {hoveredMarker.lng.toFixed(2)}°E
          </div>
          {hoveredMarker.details?.date && (
             <div className="text-[10px] text-slate-500 border-t border-white/10 mt-1 pt-1">
                {new Date(hoveredMarker.details.date).toLocaleDateString()}
             </div>
          )}
        </div>
      )}

      {/* Selected Marker Card */}
      {selectedMarker && (
        <div className="absolute bottom-4 left-4 z-20 w-64 bg-slate-900/90 backdrop-blur border border-teal-500/30 rounded-xl p-4 shadow-2xl animate-in slide-in-from-bottom-2">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-sm font-bold text-teal-300">Observation Data</h3>
            <button onClick={() => setSelectedMarker(null)} className="text-slate-500 hover:text-white">✕</button>
          </div>
          <div className="space-y-1.5 text-xs text-slate-300">
            <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">Latitude</span>
                <span className="font-mono">{selectedMarker.lat.toFixed(4)}</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500">Longitude</span>
                <span className="font-mono">{selectedMarker.lng.toFixed(4)}</span>
            </div>
            {selectedMarker.details?.date && (
                <div className="flex justify-between">
                    <span className="text-slate-500">Date</span>
                    <span>{selectedMarker.details.date}</span>
                </div>
            )}
          </div>
        </div>
      )}

      {/* Loading State */}
      {!isInitialized && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/20 backdrop-blur-[2px] z-40">
           <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
}