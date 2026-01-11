'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import Globe from 'react-globe.gl';
import type { GlobeMethods } from 'react-globe.gl';

// 1. Fix: Cast Globe to 'any' to allow htmlElementsData/onRingClick props
const InteractiveGlobe = Globe as any;

/* --------------------------------------------------
   PROPS
-------------------------------------------------- */

export interface TacticalGlobeProps {
  activeScenario: any | null;
  activeStorms?: any[];
  // ✅ FEATURE 4: Updated callback signature
  onUpdateAnalysis?: (data: { 
    count: number; 
    severity: string; 
    sitrep: string;
    affectedShips?: any[];
  }) => void;
  // ✅ FEATURE 1: Selection Props
  focusedStormId?: string | null;
  onStormSelect?: (id: string) => void;
  // ✅ NEW: Custom markers for Simulation Mode
  scenarioMarkers?: any[];
}

/* --------------------------------------------------
   COMPONENT
-------------------------------------------------- */

export default function TacticalGlobe({
  activeScenario,
  activeStorms = [],
  onUpdateAnalysis,
  focusedStormId,
  onStormSelect,
  scenarioMarkers = [], // Default to empty array
}: TacticalGlobeProps) {

  const globeEl = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  const lastCameraTarget = useRef<{
    lat: number;
    lng: number;
    id?: string;
  } | null>(null);

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [fleet, setFleet] = useState<any[]>([]);

  /* --------------------------------------------------
     1. MEASURE CONTAINER
  -------------------------------------------------- */

  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;
      setDimensions({
        width: containerRef.current.offsetWidth,
        height: containerRef.current.offsetHeight,
      });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  /* --------------------------------------------------
     2. SIMULATED FLEET (RUNS ONLY ONCE)
  -------------------------------------------------- */

  useEffect(() => {
    const ships = Array.from({ length: 60 }).map((_, i) => ({
      id: i,
      lat: Math.random() * 120 - 60,
      lng: Math.random() * 360 - 180,
      name: `Vessel-${100 + i}`,
      type: Math.random() > 0.5 ? 'CARGO' : 'TANKER',
      cargoValue: Math.floor(Math.random() * 50) + 10, // $10-60M value
    }));
    setFleet(ships);
  }, []);

  /* --------------------------------------------------
     3. CAMERA DIRECTOR (FEATURE 1 LOGIC)
  -------------------------------------------------- */

  useEffect(() => {
    if (!globeEl.current) return;

    // A. Hypothetical scenario (Static focus)
    if (activeScenario) {
      globeEl.current.pointOfView(
        { lat: activeScenario.lat, lng: activeScenario.lng, altitude: 1.8 },
        1200
      );
      lastCameraTarget.current = {
        lat: activeScenario.lat, lng: activeScenario.lng, id: activeScenario.id,
      };
      return;
    }

    // B. Historical mode
    if (activeStorms.length > 0) {
      let targetStorm = activeStorms[0]; 

      // ✅ FEATURE 1: Check for manual focus first
      if (focusedStormId) {
        const found = activeStorms.find(s => s.id === focusedStormId);
        if (found) targetStorm = found;
      } else {
         // Fallback to strongest
         targetStorm = [...activeStorms].sort((a, b) => (b.wind ?? 0) - (a.wind ?? 0))[0];
      }

      if (!targetStorm) return;

      const prev = lastCameraTarget.current;
      const movedEnough =
        !prev ||
        Math.abs(prev.lat - targetStorm.lat) > 0.5 ||
        Math.abs(prev.lng - targetStorm.lng) > 0.5 ||
        prev.id !== targetStorm.id;

      if (movedEnough) {
        globeEl.current.pointOfView(
          {
            lat: targetStorm.lat,
            lng: targetStorm.lng,
            altitude: focusedStormId ? 1.2 : 1.6, // Zoom in if focused
          },
          800
        );

        lastCameraTarget.current = {
          lat: targetStorm.lat, lng: targetStorm.lng, id: targetStorm.id,
        };
      }
    }
  }, [activeScenario, activeStorms, focusedStormId]);

  // ✅ FEATURE 1 CLICK HANDLER
  const handleStormClick = (storm: any) => {
    const stormId = storm.stormId || storm.id;
    
    if (onStormSelect && stormId) {
      onStormSelect(stormId);
    }
    
    if (!onStormSelect && globeEl.current) {
      globeEl.current.pointOfView({
        lat: storm.lat,
        lng: storm.lng,
        altitude: 0.5 
      }, 1500);
    }
  };

  /* --------------------------------------------------
     4. ENHANCED INTELLIGENCE ENGINE
  -------------------------------------------------- */

  const { visualFleet, escapeRoutes, threatAnalysis } = useMemo(() => {
    let affected = 0;
    const affectedShips: any[] = [];
    const routes: any[] = [];
    
    let majorHurricaneThreat = false;
    let totalCargoValue = 0;
    const threateningStorms = new Set<string>();

    const processedShips = fleet.map(ship => {
      let isAffected = false;
      let threatSource: any = null;

      if (activeScenario) {
        const d = Math.hypot(ship.lat - activeScenario.lat, ship.lng - activeScenario.lng);
        if (d < activeScenario.radius) {
          isAffected = true;
          threatSource = activeScenario;
        }
      }

      if (!isAffected) {
        for (const storm of activeStorms) {
          const d = Math.hypot(ship.lat - storm.lat, ship.lng - storm.lng);
          if (d < storm.radius) {
            isAffected = true;
            threatSource = storm;
            
            if (storm.wind >= 96) { 
              majorHurricaneThreat = true;
              threateningStorms.add(storm.name);
            }
            
            affectedShips.push({
              ...ship,
              threatStorm: storm.name,
              stormCategory: storm.category || 'Unknown',
              stormWind: storm.wind,
              distance: Math.round(d * 100) / 100,
            });
            
            totalCargoValue += ship.cargoValue || 0;
            break;
          }
        }
      }

      if (isAffected && threatSource) {
        affected++;
        const angle = Math.atan2(ship.lng - threatSource.lng, ship.lat - threatSource.lat);
        const safeDist = threatSource.radius * 1.5;
        routes.push({
          startLat: ship.lat,
          startLng: ship.lng,
          endLat: threatSource.lat + Math.cos(angle) * safeDist,
          endLng: threatSource.lng + Math.sin(angle) * safeDist,
          color: '#fbbf24',
        });
      }

      return {
        ...ship,
        color: isAffected ? '#ef4444' : '#ffffff',
        size: isAffected ? 1.0 : 0.3,
        label: isAffected ? `⚠️ REROUTING: ${ship.name}` : ship.name,
        isAffected,
      };
    });

    let severity = 'LOW';
    if (affected > 5 || (affected > 0 && majorHurricaneThreat)) {
      severity = 'CRITICAL';
    } else if (affected > 0) {
      severity = 'MODERATE';
    }

    let sitrep = '';
    if (severity === 'CRITICAL') {
      if (majorHurricaneThreat) {
        const stormList = Array.from(threateningStorms).join(', ');
        sitrep = `CRITICAL DISRUPTION: ${affected} vessels in major hurricane zone (${stormList}). Immediate fleet-wide diversion protocols activated.`;
      } else {
        sitrep = `MASSIVE DISRUPTION: ${affected} vessels at high risk. Fleet coordination center at DEFCON 3.`;
      }
    } else if (severity === 'MODERATE') {
      sitrep = `MODERATE DISRUPTION: ${affected} vessels requiring course correction. Regional command monitoring situation.`;
    } else {
      if (activeStorms.length > 0) {
        const stormCount = activeStorms.length;
        sitrep = `ROUTINE MONITORING: ${stormCount} active storm${stormCount > 1 ? 's' : ''} tracked. All vessels clear of immediate danger.`;
      } else if (activeScenario) {
        sitrep = `SCENARIO ACTIVE: ${activeScenario.name} simulation running. No historical storms active.`;
      } else {
        sitrep = `ALL CLEAR: No active threats detected. Fleet operations normal.`;
      }
    }

    return {
      visualFleet: processedShips,
      escapeRoutes: routes,
      threatAnalysis: {
        count: affected,
        severity,
        sitrep,
        affectedShips,
        majorHurricaneThreat,
        threateningStorms: Array.from(threateningStorms),
        totalCargoValue: Math.round(totalCargoValue),
      },
    };
  }, [fleet, activeScenario, activeStorms]);

  const lastUpdateRef = useRef<{
    count: number;
    severity: string;
    sitrep: string;
    majorHurricaneThreat: boolean;
  } | null>(null);

  useEffect(() => {
    if (!onUpdateAnalysis) return;
    
    const currentAnalysis = {
      count: threatAnalysis.count,
      severity: threatAnalysis.severity,
      sitrep: threatAnalysis.sitrep,
      majorHurricaneThreat: threatAnalysis.majorHurricaneThreat,
    };
    
    const hasChanged = !lastUpdateRef.current ||
      lastUpdateRef.current.count !== currentAnalysis.count ||
      lastUpdateRef.current.severity !== currentAnalysis.severity ||
      lastUpdateRef.current.sitrep !== currentAnalysis.sitrep ||
      lastUpdateRef.current.majorHurricaneThreat !== currentAnalysis.majorHurricaneThreat;
    
    if (hasChanged) {
      onUpdateAnalysis(threatAnalysis);
      lastUpdateRef.current = currentAnalysis;
    }
  }, [threatAnalysis, onUpdateAnalysis]);

  /* --------------------------------------------------
     6. VISUAL DATA (WITH FOCUS STYLING)
  -------------------------------------------------- */

  const combinedRings = useMemo(() => {
    const rings: any[] = [];

    if (activeScenario) {
      rings.push({
        lat: activeScenario.lat,
        lng: activeScenario.lng,
        maxRadius: activeScenario.radius,
        color: 'red',
      });
    }

    activeStorms.forEach(storm =>
      rings.push({
        lat: storm.lat,
        lng: storm.lng,
        maxRadius: storm.radius,
        color: storm.color || 'orange',
        stormId: storm.id,
        isFocused: focusedStormId === storm.id,
      })
    );

    return rings;
  }, [activeScenario, activeStorms, focusedStormId]);

  const combinedLabels = useMemo(
    () =>
      activeStorms.map(storm => ({
        lat: storm.lat,
        lng: storm.lng,
        text: `${storm.name} (${storm.wind}kt)`,
        size: focusedStormId === storm.id ? 2.2 : 1.5,
        color: focusedStormId && storm.id !== focusedStormId
          ? 'rgba(255,255,255,0.3)'
          : 'white',
        stormId: storm.id,
      })),
    [activeStorms, focusedStormId]
  );

  const stormPaths = useMemo(
    () =>
      activeStorms.map(storm => ({
        coords: storm.fullTrack || [],
        color: focusedStormId === storm.id
          ? 'rgba(255,0,0,0.6)'
          : 'rgba(255,255,255,0.15)',
      })),
    [activeStorms, focusedStormId]
  );

  /* --------------------------------------------------
     RENDER
  -------------------------------------------------- */

  return (
    <div ref={containerRef} className="w-full h-full">
      {dimensions.width > 0 && (
        <InteractiveGlobe
          ref={globeEl}
          width={dimensions.width}
          height={dimensions.height}
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          backgroundColor="rgba(0,0,0,0)"
          atmosphereColor={activeScenario || activeStorms.length ? '#ef4444' : '#3a228a'}
          atmosphereAltitude={activeScenario || activeStorms.length ? 0.25 : 0.1}

          pointsData={visualFleet}
          pointColor="color"
          pointRadius="size"
          pointAltitude={0.01}
          pointLabel="label"

          ringsData={combinedRings}
          ringColor={(d: any) => d.isFocused ? '#ffffff' : d.color}
          ringMaxRadius={(d: any) => d.maxRadius}
          ringPropagationSpeed={2}
          ringRepeatPeriod={1000}
          onRingClick={handleStormClick}

          labelsData={combinedLabels}
          labelLat="lat"
          labelLng="lng"
          labelText="text"
          labelSize="size"
          labelColor="color"
          onLabelClick={handleStormClick}

          arcsData={escapeRoutes}
          arcColor="color"
          arcDashLength={0.4}
          arcDashGap={0.2}
          arcDashAnimateTime={1000}
          arcAltitude={0.1}

          pathsData={stormPaths}
          pathPoints="coords"
          pathPointLat="lat"
          pathPointLng="lng"
          pathColor="color"
          pathDashLength={0.05}
          pathDashGap={0.02}

          // ✅ NEW: Custom HTML Elements for Simulation Mode
          htmlElementsData={scenarioMarkers}
          htmlLat={(d: any) => d.lat}
          htmlLng={(d: any) => d.lng}
          htmlElement={(d: any) => {
            const el = document.createElement('div');
            
            // Icon Styling
            if (d.type === 'PIRATE') {
              el.innerHTML = '☠️';
              el.style.fontSize = '24px';
              el.style.cursor = 'pointer';
              el.className = 'animate-pulse';
            } else if (d.type === 'BLOCKAGE') {
              el.innerHTML = '🛑';
              el.style.fontSize = '32px';
              el.className = 'animate-bounce';
            } else if (d.type === 'SHIP_QUEUE') {
              el.innerHTML = '🚢';
              el.style.fontSize = '16px';
              el.style.color = '#eab308'; // yellow-500
            } else if (d.type === 'ICE_EDGE') {
              el.innerHTML = '❄️';
              el.style.fontSize = '14px';
              el.style.opacity = '0.8';
            }
            
            // Basic Tooltip
            el.title = d.label || '';
            el.style.pointerEvents = 'auto'; // Ensure hover/click works
            
            return el;
          }}
        />
      )}
    </div>
  );
}