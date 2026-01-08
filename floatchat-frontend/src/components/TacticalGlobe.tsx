'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import Globe from 'react-globe.gl';
import type { GlobeMethods } from 'react-globe.gl';

/* --------------------------------------------------
   PROPS
-------------------------------------------------- */

export interface TacticalGlobeProps {
  activeScenario: any | null;
  activeStorms?: any[];
  onUpdateAnalysis?: (count: number) => void;
}

/* --------------------------------------------------
   COMPONENT
-------------------------------------------------- */

export default function TacticalGlobe({
  activeScenario,
  activeStorms = [],
  onUpdateAnalysis,
}: TacticalGlobeProps) {

  const globeEl = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  // Ref to track the last camera target to prevent jittering updates
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
     2. SIMULATED FLEET
  -------------------------------------------------- */

  useEffect(() => {
    const ships = Array.from({ length: 60 }).map((_, i) => ({
      id: i,
      lat: Math.random() * 120 - 60,
      lng: Math.random() * 360 - 180,
      name: `Vessel-${100 + i}`,
      type: Math.random() > 0.5 ? 'CARGO' : 'TANKER',
    }));
    setFleet(ships);
  }, []);

  /* --------------------------------------------------
     3. CAMERA DIRECTOR (SMOOTH TRACKING)
  -------------------------------------------------- */

  useEffect(() => {
    if (!globeEl.current) return;

    // A. Hypothetical scenario (Static focus)
    if (activeScenario) {
      globeEl.current.pointOfView(
        {
          lat: activeScenario.lat,
          lng: activeScenario.lng,
          altitude: 1.8,
        },
        1200
      );

      lastCameraTarget.current = {
        lat: activeScenario.lat,
        lng: activeScenario.lng,
        id: activeScenario.id,
      };
      return;
    }

    // B. Historical mode → follow strongest storm intelligently
    if (activeStorms.length > 0) {
      // Sort to find the most intense storm to track
      const focusStorm = [...activeStorms].sort(
        (a, b) => (b.wind ?? 0) - (a.wind ?? 0)
      )[0];

      if (!focusStorm) return;

      const prev = lastCameraTarget.current;

      // Only move camera if the storm has moved significantly or target changed
      // This prevents locking the user's manual controls
      const movedEnough =
        !prev ||
        Math.abs(prev.lat - focusStorm.lat) > 0.5 ||
        Math.abs(prev.lng - focusStorm.lng) > 0.5 ||
        prev.id !== focusStorm.id;

      if (movedEnough) {
        globeEl.current.pointOfView(
          {
            lat: focusStorm.lat,
            lng: focusStorm.lng,
            altitude: 1.6, // Slightly closer for active tracking
          },
          800 // Smooth transition
        );

        lastCameraTarget.current = {
          lat: focusStorm.lat,
          lng: focusStorm.lng,
          id: focusStorm.id,
        };
      }
    }
  }, [activeScenario, activeStorms]);

  // FEATURE 5: Click to focus manually
  const handleStormClick = (storm: any) => {
    if (globeEl.current) {
      globeEl.current.pointOfView({
        lat: storm.lat,
        lng: storm.lng,
        altitude: 0.5 
      }, 1500);
    }
  };

  /* --------------------------------------------------
     4. INTELLIGENCE ENGINE (CALCULATIONS)
  -------------------------------------------------- */

  const { visualFleet, escapeRoutes, affectedCount } = useMemo(() => {
    let affected = 0;
    const routes: any[] = [];

    const processedShips = fleet.map(ship => {
      let isAffected = false;
      let threatSource: any = null;

      if (activeScenario) {
        const d = Math.hypot(
          ship.lat - activeScenario.lat,
          ship.lng - activeScenario.lng
        );
        if (d < activeScenario.radius) {
          isAffected = true;
          threatSource = activeScenario;
        }
      }

      if (!isAffected) {
        for (const storm of activeStorms) {
          const d = Math.hypot(
            ship.lat - storm.lat,
            ship.lng - storm.lng
          );
          if (d < storm.radius) {
            isAffected = true;
            threatSource = storm;
            break;
          }
        }
      }

      if (isAffected && threatSource) {
        affected++;
        const angle = Math.atan2(
          ship.lng - threatSource.lng,
          ship.lat - threatSource.lat
        );
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
      };
    });

    return {
      visualFleet: processedShips,
      escapeRoutes: routes,
      affectedCount: affected,
    };
  }, [fleet, activeScenario, activeStorms]);

  /* --------------------------------------------------
     5. SAFE PARENT UPDATE
  -------------------------------------------------- */

  useEffect(() => {
    if (onUpdateAnalysis) {
      onUpdateAnalysis(affectedCount);
    }
  }, [affectedCount, onUpdateAnalysis]);

  /* --------------------------------------------------
     6. VISUAL DATA PREPARATION
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
        ...storm // Pass storm data for click handler
      })
    );

    return rings;
  }, [activeScenario, activeStorms]);

  const combinedLabels = useMemo(
    () =>
      activeStorms.map(storm => ({
        lat: storm.lat,
        lng: storm.lng,
        text: `${storm.name} (${storm.wind}kt)`,
        color: 'white',
        size: 1.5,
        ...storm
      })),
    [activeStorms]
  );

  const stormPaths = useMemo(
    () =>
      activeStorms.map(storm => ({
        coords: storm.fullTrack || [],
        color: 'rgba(255,255,255,0.15)',
      })),
    [activeStorms]
  );

  /* --------------------------------------------------
     RENDER
  -------------------------------------------------- */

  return (
    <div ref={containerRef} className="w-full h-full">
      {dimensions.width > 0 && (
        // @ts-ignore - Ignoring strict prop types to allow interaction events
        <Globe
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
          ringColor={(d: any) => () => d.color}
          ringMaxRadius={(d: any) => d.maxRadius}
          ringPropagationSpeed={2}
          ringRepeatPeriod={1000}

          labelsData={combinedLabels}
          labelLat="lat"
          labelLng="lng"
          labelText="text"
          labelSize={1.5}

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