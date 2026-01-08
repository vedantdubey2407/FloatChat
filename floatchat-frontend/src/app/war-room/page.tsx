'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useHurricanePlayback } from '@/hooks/useHurricanePlayback';

interface TacticalGlobeProps {
  activeScenario: any | null;
  activeStorms?: any[];
  onUpdateAnalysis?: (count: number) => void;
}

const TacticalGlobe = dynamic<TacticalGlobeProps>(() => import('@/components/TacticalGlobe'), { 
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full text-blue-500 animate-pulse">Initializing Tactical Display...</div>
});

const SCENARIOS = [
  { id: 'hurricane', name: 'Atlantic Hurricane', icon: '🌪️', lat: 25, lng: -40, radius: 25, baseCost: 1.2 },
  { id: 'pirates', name: 'Somali Pirates', icon: '🏴‍☠️', lat: 10, lng: 55, radius: 12, baseCost: 3.5 },
  { id: 'suez', name: 'Suez Canal Blockage', icon: '⚓', lat: 30.5, lng: 32.5, radius: 4, baseCost: 5.0 },
  { id: 'arctic', name: 'Arctic Freeze', icon: '❄️', lat: 78, lng: 15, radius: 20, baseCost: 0.8 },
];

export default function WarRoomPage() {
  const [mode, setMode] = useState<'SIMULATION' | 'HISTORICAL'>('SIMULATION');
  const [activeScenario, setActiveScenario] = useState<any | null>(null);
  const [affectedCount, setAffectedCount] = useState(0);

  const { 
    activeStorms, 
    currentDate, 
    selectedYear, 
    setSelectedYear, 
    isPlaying, 
    setIsPlaying,
    availableYears,
    seasonStats,
    playbackSpeed,    // ✅ Get Speed State
    setPlaybackSpeed  // ✅ Get Speed Setter
  } = useHurricanePlayback();

  const estimatedCost = (affectedCount * 1.2).toFixed(1);
  const estimatedDelay = affectedCount * 24; 

  return (
    <div className="w-full h-screen bg-slate-950 relative overflow-hidden flex">
      
      {/* 1. LEFT PANEL */}
      <div className="w-80 h-full bg-black/40 backdrop-blur-xl border-r border-white/10 pt-24 px-6 relative z-10 flex flex-col gap-6">
        
        {/* MODE TOGGLE */}
        <div className="flex p-1 bg-gray-900 rounded-lg border border-white/10">
           <button onClick={() => setMode('SIMULATION')} className={`flex-1 py-2 text-[10px] font-bold rounded transition-all ${mode === 'SIMULATION' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}>HYPOTHETICAL</button>
           <button onClick={() => setMode('HISTORICAL')} className={`flex-1 py-2 text-[10px] font-bold rounded transition-all ${mode === 'HISTORICAL' ? 'bg-red-600 text-white' : 'text-gray-500 hover:text-white'}`}>HISTORICAL</button>
        </div>

        {/* MODE A: SIMULATION CONTROLS */}
        {mode === 'SIMULATION' && (
          <div className="animate-in fade-in slide-in-from-left-4 space-y-6">
            <div>
              <h2 className="text-blue-500 text-xs font-bold tracking-[0.2em] mb-2">SCENARIO INJECTION</h2>
              <h1 className="text-3xl text-white font-black uppercase italic">Simulate<br/>Disaster</h1>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {SCENARIOS.map((scenario) => (
                <button key={scenario.id} onClick={() => setActiveScenario(scenario)} className={`p-4 rounded-xl border text-left transition-all group ${activeScenario?.id === scenario.id ? 'bg-blue-900/40 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-gray-900 border-gray-700 hover:border-blue-500 hover:bg-blue-900/20'}`}>
                  <div className="text-gray-300 font-bold group-hover:text-white transition-colors">{scenario.icon} {scenario.name}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* MODE B: HISTORICAL CONTROLS */}
        {mode === 'HISTORICAL' && (
          <div className="animate-in fade-in slide-in-from-right-4 space-y-6">
            <div>
              <h2 className="text-red-500 text-xs font-bold tracking-[0.2em] mb-2">NOAA ARCHIVES</h2>
              <h1 className="text-3xl text-white font-black uppercase italic">Historical<br/>Replay</h1>
            </div>

            <div className="p-4 bg-gray-900 rounded-xl border border-white/10 space-y-4">
               {/* Year Selector */}
               <div className="flex justify-between items-center">
                 <span className="text-gray-400 text-xs font-bold">SELECT YEAR</span>
                 <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="bg-black text-white border border-gray-600 rounded px-2 py-1 text-sm font-mono max-w-[100px]">
                   {availableYears.length > 0 ? (availableYears.map(y => <option key={y} value={y}>{y}</option>)) : (<option>Loading...</option>)}
                 </select>
               </div>

               {/* Play Button */}
               <button onClick={() => setIsPlaying(!isPlaying)} className={`w-full py-3 rounded font-bold text-sm tracking-widest transition-all ${isPlaying ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white shadow-lg`}>
                 {isPlaying ? '⏸ PAUSE' : '▶ PLAY SEASON'}
               </button>

               {/* ✅ SPEED CONTROLS */}
               <div className="flex items-center justify-between border-t border-white/10 pt-3">
                  <span className="text-gray-500 text-[10px] font-bold">SPEED</span>
                  <div className="flex gap-1">
                    {[200, 100, 20].map((speed) => (
                      <button 
                        key={speed}
                        onClick={() => setPlaybackSpeed(speed)}
                        className={`px-3 py-1 text-[10px] font-mono rounded border transition-colors ${playbackSpeed === speed ? 'bg-red-500/20 border-red-500 text-red-300' : 'bg-black border-gray-700 text-gray-500 hover:text-white'}`}
                      >
                        {speed === 200 ? '1x' : speed === 100 ? '2x' : '10x'}
                      </button>
                    ))}
                  </div>
               </div>

               {/* Date Display */}
               <div className="text-center p-2 bg-black rounded border border-white/5">
                  <div className="text-gray-500 text-[10px] uppercase">Current Date</div>
                  <div className="text-xl font-mono font-bold text-white">
                    {currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
               </div>
            </div>

            {/* Stats */}
            {seasonStats && (
              <div className="grid grid-cols-2 gap-2">
                 <MetricCard label="Season Type" value={seasonStats.classification} color="text-yellow-400" />
                 <MetricCard label="Max Wind" value={`${seasonStats.maxWind} kt`} color="text-white" />
                 <MetricCard label="Strongest" value={seasonStats.strongestStorm ? seasonStats.strongestStorm.substring(0, 9) : 'N/A'} color="text-red-400" />
                 <MetricCard label="Risk Focus" value={seasonStats.dominantRegion} color="text-blue-400" />
              </div>
            )}
          </div>
        )}

        <div className="mt-auto mb-10 p-4 bg-gray-900/50 border border-white/10 rounded-lg">
           <p className="text-gray-400 text-xs leading-relaxed">
             {mode === 'SIMULATION' && activeScenario ? `Simulating ${activeScenario.name}.` : mode === 'HISTORICAL' && activeStorms.length > 0 ? `Tracking ${activeStorms.length} active storm cells.` : "System Standby."}
           </p>
        </div>
      </div>

      {/* 2. CENTER: Map */}
      <div className="flex-1 h-full relative bg-gradient-to-b from-slate-900 to-black">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
        <div className="absolute inset-0 z-0">
          <TacticalGlobe activeScenario={mode === 'SIMULATION' ? activeScenario : null} activeStorms={mode === 'HISTORICAL' ? activeStorms : []} onUpdateAnalysis={setAffectedCount} />
        </div>
        {mode === 'HISTORICAL' && (
           <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-1/2 z-20">
              <input type="range" min={new Date(selectedYear, 0, 1).getTime()} max={new Date(selectedYear, 11, 31).getTime()} value={currentDate.getTime()} className="w-full accent-red-500 h-1 bg-white/20 rounded-lg" readOnly />
           </div>
        )}
      </div>

      {/* 3. RIGHT PANEL */}
      <div className="w-80 h-full bg-black/40 backdrop-blur-xl border-l border-white/10 pt-24 px-6 relative z-10">
        <h2 className="text-blue-400 text-xs font-bold tracking-[0.2em] mb-6">IMPACT FORECAST</h2>
        <div className="flex flex-col gap-6">
          <MetricCard label="Vessels at Risk" value={affectedCount.toString()} color={affectedCount > 0 ? "text-red-500" : "text-white"} />
          <MetricCard label="Est. Fleet Delay" value={`+${estimatedDelay}h`} color={affectedCount > 0 ? "text-red-500" : "text-gray-500"} />
          <MetricCard label="Est. Cost Surge" value={`$${estimatedCost}M`} color={affectedCount > 0 ? "text-red-500" : "text-gray-500"} />
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string, value: string, color: string }) {
  return <div className="p-3 bg-gray-900/50 rounded-lg border border-white/5"><div className="text-gray-500 text-[10px] uppercase mb-1">{label}</div><div className={`text-xl font-mono font-bold ${color}`}>{value}</div></div>;
}