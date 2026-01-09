'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import Globe from 'react-globe.gl';
import type { GlobeMethods } from 'react-globe.gl';

// 1. Fix: Cast Globe to 'any' to allow onRingClick/onLabelClick props
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

  // ✅ FEATURE 1 CLICK HANDLER - FIXED
  const handleStormClick = (storm: any) => {
    // Handle both storm objects (from props) and click data (from rings/labels)
    const stormId = storm.stormId || storm.id;
    
    if (onStormSelect && stormId) {
      onStormSelect(stormId);
    }
    
    // Legacy fallback: Manual camera focus
    if (!onStormSelect && globeEl.current) {
      globeEl.current.pointOfView({
        lat: storm.lat,
        lng: storm.lng,
        altitude: 0.5 
      }, 1500);
    }
  };

  /* --------------------------------------------------
     4. ENHANCED INTELLIGENCE ENGINE (FEATURE 4)
  -------------------------------------------------- */

  const { visualFleet, escapeRoutes, threatAnalysis } = useMemo(() => {
    let affected = 0;
    const affectedShips: any[] = [];
    const routes: any[] = [];
    
    // ✅ FEATURE 4: Track threat factors
    let majorHurricaneThreat = false;
    let totalCargoValue = 0;
    const threateningStorms = new Set<string>();

    const processedShips = fleet.map(ship => {
      let isAffected = false;
      let threatSource: any = null;
      let threatCategory = '';

      if (activeScenario) {
        const d = Math.hypot(ship.lat - activeScenario.lat, ship.lng - activeScenario.lng);
        if (d < activeScenario.radius) {
          isAffected = true;
          threatSource = activeScenario;
          threatCategory = 'SCENARIO';
        }
      }

      if (!isAffected) {
        for (const storm of activeStorms) {
          const d = Math.hypot(ship.lat - storm.lat, ship.lng - storm.lng);
          if (d < storm.radius) {
            isAffected = true;
            threatSource = storm;
            
            // ✅ FEATURE 4: Check for major hurricane (Cat 3+)
            if (storm.wind >= 96) { // Cat 3+ threshold
              majorHurricaneThreat = true;
              threateningStorms.add(storm.name);
            }
            
            // Track affected ships
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

    // ✅ FEATURE 4: Calculate severity level
    let severity = 'LOW';
    if (affected > 5 || (affected > 0 && majorHurricaneThreat)) {
      severity = 'CRITICAL';
    } else if (affected > 0) {
      severity = 'MODERATE';
    }

    // ✅ FEATURE 4: Generate SITREP based on analysis
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

  // ✅ FIX: Better approach - use a ref to track if we should update
  const lastUpdateRef = useRef<{
    count: number;
    severity: string;
    sitrep: string;
    majorHurricaneThreat: boolean;
  } | null>(null);

  /* --------------------------------------------------
     5. SAFE PARENT UPDATE (UPDATED FOR FEATURE 4)
  -------------------------------------------------- */

  useEffect(() => {
    if (!onUpdateAnalysis) return;
    
    // Create a simplified version of threatAnalysis for comparison
    const currentAnalysis = {
      count: threatAnalysis.count,
      severity: threatAnalysis.severity,
      sitrep: threatAnalysis.sitrep,
      majorHurricaneThreat: threatAnalysis.majorHurricaneThreat,
    };
    
    // Only update if the core threat analysis has actually changed
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

    // Storm rings with focus styling
    activeStorms.forEach(storm =>
      rings.push({
        lat: storm.lat,
        lng: storm.lng,
        maxRadius: storm.radius,
        color: storm.color || 'orange',
        stormId: storm.id,
        // ✅ Focus styling: White ring for focused storm
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
        // ✅ Focus styling: Larger and brighter for focused storm
        size: focusedStormId === storm.id ? 2.2 : 1.5,
        color: focusedStormId && storm.id !== focusedStormId
          ? 'rgba(255,255,255,0.3)' // Dimmed for non-focused storms
          : 'white',
        stormId: storm.id,
      })),
    [activeStorms, focusedStormId]
  );

  const stormPaths = useMemo(
    () =>
      activeStorms.map(storm => ({
        coords: storm.fullTrack || [],
        // ✅ Focus styling: Highlighted path for focused storm
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
          // ✅ Apply focus styling to rings
          ringColor={(d: any) => d.isFocused ? '#ffffff' : d.color}
          ringMaxRadius={(d: any) => d.maxRadius}
          ringPropagationSpeed={2}
          ringRepeatPeriod={1000}
          onRingClick={handleStormClick} // ✅ Now valid due to InteractiveGlobe cast

          labelsData={combinedLabels}
          labelLat="lat"
          labelLng="lng"
          labelText="text"
          labelSize="size"
          labelColor="color"
          onLabelClick={handleStormClick} // ✅ Now valid

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
        />
      )}
    </div>
  );
}