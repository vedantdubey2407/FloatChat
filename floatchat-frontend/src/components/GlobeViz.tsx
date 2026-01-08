'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import * as THREE from 'three';
import ReactMarkdown from 'react-markdown';

// Imports
import { OceanPoint, RouteData, LayerType } from '../types/naval';
import ChatConsole from './ChatConsole';
import CaptainsDashboard from './CaptainsDashboard';

// Dynamically import Globe to disable SSR (Server-Side Rendering)
const Globe = dynamic(() => import('react-globe.gl'), { ssr: false });

interface GlobeVizProps {
  flyTo?: { lat: number; lng: number; zoom: number } | null;
  activeStorms?: any[];
}

export default function GlobeViz({ flyTo, activeStorms = [] }: GlobeVizProps) {
  const globeEl = useRef<any>(undefined);

  /* --- STATE --- */
  const [rawFloats, setRawFloats] = useState<OceanPoint[]>([]);
  const [layer, setLayer] = useState<LayerType>('TEMP');
  
  // Sentinel State
  const [selectedPoint, setSelectedPoint] = useState<OceanPoint | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Route State
  const [plannerMode, setPlannerMode] = useState(false);
  const [routePoints, setRoutePoints] = useState<{ lat: number; lng: number }[]>([]);
  const [activeTab, setActiveTab] = useState<'SUMMARY' | 'RISKS' | 'WEATHER' | 'DECISION'>('SUMMARY');
  const [routeReport, setRouteReport] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [explaining, setExplaining] = useState(false);

  // 🚢 SIMULATION STATE
  const [shipPosition, setShipPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [shipPath, setShipPath] = useState<{ lat: number; lng: number }[]>([]);
  const animationRef = useRef<number | null>(null);
  const progressRef = useRef(0); 

  /* --- VISUALS --- */
  const hazardZones = useMemo(() => layer === 'TEMP' ? rawFloats.filter(p => p.temp > 29.5) : [], [rawFloats, layer]);
  const waveRipples = useMemo(() => layer === 'WAVES' ? rawFloats.filter(p => (p.wave_height || 0) > 1.5) : [], [rawFloats, layer]);
  
  const activeRings = useMemo(() => {
    const baseRings = layer === 'WAVES' ? waveRipples : hazardZones;
    const stormRings = activeStorms.map(storm => ({
       lat: storm.lat,
       lng: storm.lng,
       maxRadius: storm.radius,
       color: storm.color,
       propagationSpeed: 2,
       repeatPeriod: 800
    }));
    return [...baseRings, ...stormRings];
  }, [layer, waveRipples, hazardZones, activeStorms]);

  const getPointColor = (d: any) => {
    switch(layer) {
      case 'WAVES': return d.wave_height > 2.0 ? '#ffffff' : d.wave_height > 1.0 ? '#60a5fa' : '#1e3a8a';
      case 'TEMP':  return d.temp > 29 ? '#ef4444' : d.temp > 20 ? '#fbbf24' : '#60a5fa';
      case 'PSU':   return d.psu > 35 ? '#f97316' : '#f1f5f9';
      case 'DOXY':  return d.doxy > 200 ? '#10b981' : '#6b7280';
      default: return '#fff';
    }
  };

  /* --- LOGIC --- */
  useEffect(() => {
    fetch('http://localhost:8000/ocean-data')
      .then(r => r.json())
      .then(data => setRawFloats(data.map((f: any) => ({
          lat: f.LATITUDE, lng: f.LONGITUDE, temp: f.TEMP, psu: f.PSU ?? 35, doxy: f.DOXY ?? 200, wave_height: f.WAVE_HEIGHT ?? 0.5
      }))))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (flyTo && globeEl.current) {
      globeEl.current.pointOfView({ lat: flyTo.lat, lng: flyTo.lng, altitude: flyTo.zoom }, 2000);
    }
  }, [flyTo]);

  // Lighting & Atmosphere
  useEffect(() => {
    if (!globeEl.current) return;
    const scene = globeEl.current.scene();
    if ((scene as any).__enhanced) return;
    (scene as any).__enhanced = true;
    
    scene.add(new THREE.AmbientLight(0x444444));
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(1, 1, 1);
    scene.add(sun);
    
    new THREE.TextureLoader().load('https://raw.githubusercontent.com/turban/webgl-earth/master/images/fair_clouds_4k.png', tex => {
       const clouds = new THREE.Mesh(new THREE.SphereGeometry(100.01, 64, 64), new THREE.MeshPhongMaterial({ map: tex, transparent: true, opacity: 0.8 }));
       scene.add(clouds);
       (function animate() { clouds.rotation.y += 0.0003; requestAnimationFrame(animate); })();
    });
  }, []);
 
  /* --- HANDLERS --- */
  const handleConsoleCommand = (cmd: any) => {
    if (!cmd) return;
    console.log("🚀 Globe Recieved Command:", cmd);

    if (cmd.lat && cmd.lng && globeEl.current) {
       globeEl.current.pointOfView({ lat: cmd.lat, lng: cmd.lng, altitude: cmd.zoom || 1.5 }, 2500);
    }
    if (cmd.action === 'SENTINEL_SCAN') {
        selectedPoint ? runSentinel() : console.warn("No point selected for scan");
    }
    if (cmd.action === 'ENABLE_PLANNER') setPlannerMode(true);
    if (cmd.action === 'CHANGE_LAYER') setLayer(cmd.layer);
  };

  const runSentinel = async () => {
    if (!selectedPoint) return;
    setAnalyzing(true);
    try {
      const res = await fetch('http://localhost:8000/sentinel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ context: JSON.stringify(selectedPoint) })
      });
      const data = await res.json();
      setAnalysis(data.alert);
    } catch { setAnalysis('⚠️ Sentinel unavailable.'); }
    setAnalyzing(false);
  };

  // ✅ FIXED CLICK LOGIC
  const handleMapClick = (lat: number, lng: number) => {
    // 1. If NOT in planner mode, do nothing (or clear selection)
    if (!plannerMode) return;

    console.log("📍 Route Point Added:", lat, lng);

    const point = { lat, lng };
    
    if (routePoints.length < 2) {
      const updated = [...routePoints, point];
      setRoutePoints(updated);

      // If we now have 2 points, calculate route
      if (updated.length === 2) {
        setCalculating(true);
        setActiveTab('SUMMARY');
        
        fetch('http://localhost:8000/plan-route', {
            method: 'POST', 
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ start_lat: updated[0].lat, start_lng: updated[0].lng, end_lat: updated[1].lat, end_lng: updated[1].lng })
        })
        .then(r => r.json())
        .then(data => {
            setRouteData(data);
            setRouteReport("Ready");
            startShipSimulation(updated[0], updated[1]);
            
            if (data.alternate_routes) {
                setExplaining(true);
                fetch('http://localhost:8000/explain-decision', {
                    method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ chosen_route: data.basic_info, alternate_routes: data.alternate_routes, vessel_speed: 20 })
                }).then(r=>r.json()).then(d => {
                    setRouteData(prev => prev ? ({ ...prev, decision_analysis: d }) : null);
                    setExplaining(false);
                });
            }
        })
        .catch(() => setRouteReport('Error'))
        .finally(() => setCalculating(false));
      }
    } else {
      // Reset if clicking a 3rd time
      setRoutePoints([point]);
      setRouteReport(null);
      setRouteData(null);
      stopShipSimulation();
    }
  };

  // 🚢 SHIP LOGIC
  const startShipSimulation = (start: { lat: number, lng: number }, end: { lat: number, lng: number }) => {
     setShipPath([start, end]);
     progressRef.current = 0;
     if (animationRef.current) cancelAnimationFrame(animationRef.current);

     const animate = () => {
       progressRef.current += 0.003; 
       if (progressRef.current > 1) progressRef.current = 0; 
       const currentLat = start.lat + (end.lat - start.lat) * progressRef.current;
       const currentLng = start.lng + (end.lng - start.lng) * progressRef.current;
       setShipPosition({ lat: currentLat, lng: currentLng });
       animationRef.current = requestAnimationFrame(animate);
     };
     animate();
  };

  const stopShipSimulation = () => {
     if (animationRef.current) cancelAnimationFrame(animationRef.current);
     setShipPosition(null);
     setShipPath([]);
  };

  const stormLabels = activeStorms.map(storm => ({
    lat: storm.lat, lng: storm.lng, text: `${storm.name} (${storm.wind}kt)`, color: "white", size: 1.5
  }));
  /* --- ✅ NEW: LISTEN FOR HEADER BUTTON CLICK --- */
  useEffect(() => {
    const handleToggle = () => {
      setPlannerMode(prev => !prev);
      // Reset state when toggling
      setRoutePoints([]);
      setRouteReport(null);
      setSelectedPoint(null);
      stopShipSimulation();
    };

    window.addEventListener('TOGGLE_PLANNER', handleToggle);
    return () => window.removeEventListener('TOGGLE_PLANNER', handleToggle);
  }, []);

  return (
    <div className={`relative w-full h-full bg-black ${plannerMode ? 'cursor-crosshair' : 'cursor-default'}`}>
      <ChatConsole 
          onCommand={handleConsoleCommand}
          plannerMode={plannerMode} 
          onTogglePlanner={() => { 
             setPlannerMode(!plannerMode); 
             setRoutePoints([]); 
             setRouteReport(null); 
             setSelectedPoint(null); 
             stopShipSimulation();
          }}
      />

      <div className="absolute bottom-10 left-10 z-30 flex flex-col gap-2">
        <span className="text-gray-400 text-xs tracking-widest uppercase mb-1 font-bold">Bio-Scanner Layers</span>
        <div className="flex bg-gray-900/90 backdrop-blur-md rounded-lg p-1 border border-white/20 shadow-2xl">
          {(['TEMP', 'PSU', 'DOXY', 'WAVES'] as LayerType[]).map((l) => (
            <button 
              key={l} 
              onClick={() => setLayer(l)} 
              className={`px-4 py-2 rounded text-xs font-bold transition-all border border-transparent ${
                layer === l 
                  ? l === 'TEMP' ? 'bg-red-600 text-white border-red-400'
                  : l === 'PSU' ? 'bg-orange-500 text-white border-orange-400'
                  : l === 'DOXY' ? 'bg-emerald-500 text-white border-emerald-400'
                  : 'bg-blue-500 text-white border-blue-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {l === 'TEMP' ? '🌡️' : l === 'WAVES' ? '🌊' : l === 'PSU' ? '🧂' : '🧬'} {l}
            </button>
          ))}
        </div>
      </div>

      <Globe
        ref={globeEl}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        atmosphereColor="#3a228a"
        pointsData={rawFloats}
        pointColor={getPointColor}
        pointAltitude={(d: any) => layer==='WAVES' ? Math.max(0.1, d.wave_height*0.15) : 0.1}
        pointRadius={0.4}
        
        ringsData={activeRings}
        ringColor={(d: any) => (t: number) => d.color ? d.color : (layer==='WAVES' ? `rgba(200,200,255,${1-t})` : `rgba(255,0,0,${1-t})`)}
        ringMaxRadius={(d: any) => d.maxRadius || 5}
        ringPropagationSpeed={(d: any) => d.propagationSpeed || 2}
        ringRepeatPeriod={(d: any) => d.repeatPeriod || 800}

        labelsData={stormLabels}
        labelLat={(d: any) => d.lat}
        labelLng={(d: any) => d.lng}
        labelText={(d: any) => d.text}
        labelColor={() => 'rgba(255, 255, 255, 0.75)'}
        labelSize={1.5}
        labelDotRadius={0.5}

        // ✅ FIXED: Handle clicks on points AND empty space
        onPointClick={(p: any) => { 
            if (plannerMode) {
                // If planning route, point click = add waypoint
                handleMapClick(p.lat, p.lng);
            } else {
                // Else select for details
                setSelectedPoint(p); 
                setAnalysis(null); 
            }
        }}
        onGlobeClick={(d: any) => {
            if (d && d.lat && d.lng) handleMapClick(d.lat, d.lng);
        }}

        arcsData={routePoints.length === 2 ? [{ startLat: routePoints[0].lat, startLng: routePoints[0].lng, endLat: routePoints[1].lat, endLng: routePoints[1].lng, color: '#00ff00' }] : []}
        arcDashGap={0.2}
        arcDashAnimateTime={1500}
        
        objectsData={shipPosition ? [shipPosition] : []}
        objectLat="lat"
        objectLng="lng"
        objectAltitude={0.05}
        objectThreeObject={() => {
            const group = new THREE.Group();
            const hullGeometry = new THREE.ConeGeometry(0.5, 1.5, 8);
            hullGeometry.rotateX(Math.PI / 2);
            const hullMaterial = new THREE.MeshLambertMaterial({ color: '#fbbf24' });
            const hull = new THREE.Mesh(hullGeometry, hullMaterial);
            const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshLambertMaterial({ color: '#fff' }));
            cabin.position.set(0, 0, -0.4);
            group.add(hull);
            group.add(cabin);
            return group;
        }}
      />

      {/* Popups and Status */}
      {selectedPoint && !plannerMode && (
        <div className="absolute top-20 left-10 z-20 p-5 bg-black/80 backdrop-blur-md border border-blue-500/50 rounded-2xl text-white shadow-2xl max-w-sm">
          <h3 className="text-xl font-bold text-blue-400 mb-2">Float Data</h3>
          <div className="text-4xl font-bold mb-2">{layer === 'WAVES' ? `${selectedPoint.wave_height}m` : `${selectedPoint.temp}°C`}</div>
          {analysis && <div className="mt-3 p-3 bg-blue-900/30 rounded text-xs"><ReactMarkdown>{analysis}</ReactMarkdown></div>}
          <button onClick={runSentinel} disabled={analyzing} className="w-full mt-4 py-2 bg-blue-600 rounded font-bold hover:bg-blue-500">{analyzing ? 'Scanning...' : 'Analyze'}</button>
        </div>
      )}

      {calculating && <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30 p-6 bg-black/80 rounded-xl text-yellow-200 animate-pulse border border-yellow-500">📍 CALCULATING NAVAL ROUTE...</div>}
      
      {routeReport && routeData && (
         <CaptainsDashboard 
            routeData={routeData} 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
            explaining={explaining}
            onClose={() => { setRouteReport(null); setRouteData(null); stopShipSimulation(); }}
         />
      )}

    </div>
  );
}