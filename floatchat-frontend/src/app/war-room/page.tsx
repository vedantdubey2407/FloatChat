'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useHurricanePlayback } from '@/hooks/useHurricanePlayback';

interface TacticalGlobeProps {
  activeScenario: any | null;
  activeStorms?: any[];
  // ✅ FEATURE 4: Updated interface
  onUpdateAnalysis?: (data: { 
    count: number; 
    severity: string; 
    sitrep: string;
    affectedShips?: any[];
  }) => void;
  // ✅ FEATURE 1: Add new props to interface
  focusedStormId?: string | null;
  onStormSelect?: (id: string) => void;
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

// ✅ FEATURE 4: Type for impact analysis
interface ImpactAnalysis {
  count: number;
  severity: string;
  sitrep: string;
  affectedShips?: any[];
  majorHurricaneThreat?: boolean;
  threateningStorms?: string[];
  totalCargoValue?: number;
  timestamp?: string;
}

// ✅ FEATURE 4: Helper function for severity colors
const getSeverityColor = (severity: string): string => {
  switch (severity) {
    case 'CRITICAL': return 'bg-red-500 text-white';
    case 'MODERATE': return 'bg-orange-500 text-white';
    case 'LOW': return 'bg-green-500 text-white';
    default: return 'bg-gray-500 text-white';
  }
};

// ✅ FEATURE 4: Helper function for severity border colors
const getSeverityBorderColor = (severity: string): string => {
  switch (severity) {
    case 'CRITICAL': return 'border-red-500/50';
    case 'MODERATE': return 'border-orange-500/50';
    case 'LOW': return 'border-green-500/50';
    default: return 'border-gray-500/50';
  }
};

// ✅ FEATURE 4: Helper function for severity text colors
const getSeverityTextColor = (severity: string): string => {
  switch (severity) {
    case 'CRITICAL': return 'text-red-400';
    case 'MODERATE': return 'text-orange-400';
    case 'LOW': return 'text-green-400';
    default: return 'text-gray-400';
  }
};

export default function WarRoomPage() {
  const [mode, setMode] = useState<'SIMULATION' | 'HISTORICAL'>('SIMULATION');
  const [activeScenario, setActiveScenario] = useState<any | null>(null);
  // ✅ FEATURE 4: Enhanced state for impact analysis
  const [impactAnalysis, setImpactAnalysis] = useState<ImpactAnalysis>({
    count: 0,
    severity: 'LOW',
    sitrep: 'ALL CLEAR: No active threats detected. Fleet operations normal.',
  });

  const { 
    activeStorms, 
    currentDate, 
    selectedYear, 
    setSelectedYear, 
    isPlaying, 
    setIsPlaying,
    availableYears,
    seasonStats,
    playbackSpeed,
    setPlaybackSpeed,
    // ✅ FEATURE 1: Consume new state
    focusedStormId,
    setFocusedStormId,
    // ✅ FEATURE 2 & 3: Consume focused storm stats
    focusedStormStats,
  } = useHurricanePlayback();

  // ✅ FEATURE 4: Update calculations to use impactAnalysis.count
  const estimatedCost = (impactAnalysis.count * 1.2).toFixed(1);
  const estimatedDelay = impactAnalysis.count * 24;
  const cargoRiskValue = impactAnalysis.totalCargoValue 
    ? `$${Math.round(impactAnalysis.totalCargoValue / 10)}M` 
    : '$0M';

  // ✅ FIX: Use useCallback to memoize the handler and prevent infinite loop
  const handleAnalysisUpdate = useCallback((data: ImpactAnalysis) => {
    setImpactAnalysis(prev => {
      // Only update if data has actually changed
      if (JSON.stringify(prev) === JSON.stringify(data)) {
        return prev;
      }
      return data;
    });
  }, []);

  return (
    <div className="w-full h-screen bg-slate-950 relative overflow-hidden flex">
      
      {/* ✅ FEATURE 5: DATA AUTHENTICITY LABEL (Fixed at bottom-left) */}
      <div className="absolute bottom-4 left-4 z-50 pointer-events-none">
        <div className="text-white/30 text-[10px] font-mono tracking-tight">
          DATA SOURCE: NOAA HURDAT2 (1851–2024). Historical Replay - Not a Forecast.
        </div>
      </div>

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

               {/* SPEED CONTROLS */}
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

            {/* ✅ FEATURE 5: SEASON SUMMARY WIDGET */}
            {seasonStats && !focusedStormId && (
              <div className="bg-slate-900/80 border border-white/10 rounded-xl p-4 space-y-4">
                <div>
                  <div className="text-gray-400 text-xs uppercase tracking-widest mb-1">Season Summary</div>
                  <div className="flex items-baseline justify-between">
                    <div className="text-2xl font-bold text-white">{selectedYear}</div>
                    <div className={`text-sm font-bold ${seasonStats.classificationColor}`}>
                      {seasonStats.classification}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center">
                    <div className="text-gray-500 text-[10px] uppercase">Total Storms</div>
                    <div className="text-xl font-mono font-bold text-white">{seasonStats.totalStorms}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-gray-500 text-[10px] uppercase">Peak Wind</div>
                    <div className="text-xl font-mono font-bold text-white">{seasonStats.maxWind} kt</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-gray-500 text-[10px] uppercase">Strongest Storm</div>
                  <div className="text-white font-semibold text-sm truncate">
                    {seasonStats.strongestStorm}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2">
                  <div className="text-center">
                    <div className="text-gray-500 text-[10px] uppercase">Major</div>
                    <div className="text-sm font-bold text-red-400">{seasonStats.majorHurricanesCount}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-gray-500 text-[10px] uppercase">Duration</div>
                    <div className="text-sm font-bold text-white">{seasonStats.seasonDuration}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-gray-500 text-[10px] uppercase">Focus</div>
                    <div className="text-sm font-bold text-blue-400">{seasonStats.dominantRegion}</div>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10">
                  <div className="text-gray-400 text-[10px] uppercase">Season Intensity</div>
                  <div className="text-xs text-gray-300 mt-1">
                    {seasonStats.majorHurricanesCount > 0 ? 
                      `${seasonStats.majorHurricanesCount} major hurricane${seasonStats.majorHurricanesCount !== 1 ? 's' : ''}` : 
                      'No major hurricanes'}
                  </div>
                </div>
              </div>
            )}

            {/* Legacy Stats (when season summary is not shown) */}
            {seasonStats && focusedStormId && (
              <div className="grid grid-cols-2 gap-2">
                 <MetricCard label="Season Type" value={seasonStats.classification} color={seasonStats.classificationColor} />
                 <MetricCard label="Max Wind" value={`${seasonStats.maxWind} kt`} color="text-white" />
                 <MetricCard label="Strongest" value={seasonStats.strongestStorm ? seasonStats.strongestStorm.substring(0, 9) : 'N/A'} color="text-red-400" />
                 <MetricCard label="Risk Focus" value={seasonStats.dominantRegion} color="text-blue-400" />
              </div>
            )}
          </div>
        )}

        <div className="mt-auto mb-10 p-4 bg-gray-900/50 border border-white/10 rounded-lg">
           <p className="text-gray-400 text-xs leading-relaxed">
             {mode === 'SIMULATION' && activeScenario ? `Simulating ${activeScenario.name}.` : 
              mode === 'HISTORICAL' && activeStorms.length > 0 ? `Tracking ${activeStorms.length} active storm cells.` : 
              "System Standby."}
           </p>
        </div>
      </div>

      {/* 2. CENTER: Map */}
      <div className="flex-1 h-full relative bg-gradient-to-b from-slate-900 to-black">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
        <div className="absolute inset-0 z-0">
          <TacticalGlobe 
            activeScenario={mode === 'SIMULATION' ? activeScenario : null} 
            activeStorms={mode === 'HISTORICAL' ? activeStorms : []} 
            onUpdateAnalysis={handleAnalysisUpdate}
            // ✅ FEATURE 1: Pass Props
            focusedStormId={focusedStormId}
            onStormSelect={setFocusedStormId} 
          />
        </div>
        {mode === 'HISTORICAL' && (
           <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-1/2 z-20">
              <input type="range" min={new Date(selectedYear, 0, 1).getTime()} max={new Date(selectedYear, 11, 31).getTime()} value={currentDate.getTime()} className="w-full accent-red-500 h-1 bg-white/20 rounded-lg" readOnly />
           </div>
        )}
      </div>

      {/* 3. RIGHT PANEL */}
      <div className="w-80 h-full bg-black/40 backdrop-blur-xl border-l border-white/10 pt-24 px-6 relative z-10 overflow-y-auto">
        
        {/* ✅ FEATURE 2 & 3: STORM INTELLIGENCE CARD */}
        {focusedStormStats && mode === 'HISTORICAL' ? (
          <div className="space-y-6 mb-6">
            <h2 className="text-blue-400 text-xs font-bold tracking-[0.2em] mb-2">STORM INTELLIGENCE</h2>
            
            <div className="bg-slate-900/90 border border-blue-500/50 rounded-xl p-4 space-y-4">
              {/* Storm Name and Year */}
              <div className="mb-2">
                <div className="text-gray-400 text-xs uppercase tracking-widest">Cyclone Identity</div>
                <div className="flex items-baseline justify-between">
                  <div className="text-2xl font-bold text-white truncate mr-2">{focusedStormStats.name}</div>
                  <div className="text-gray-400 font-mono text-sm">{focusedStormStats.year}</div>
                </div>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center justify-between mb-2">
                <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${focusedStormStats.isActive ? 'bg-red-500/20 text-red-400' : 'bg-gray-700/50 text-gray-400'}`}>
                  {focusedStormStats.status}
                </div>
                <div className="text-gray-500 text-xs font-mono">
                  {focusedStormStats.trackPoints} data pts
                </div>
              </div>

              {/* Current Intensity */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-black/40 rounded-lg p-3 border border-white/5">
                  <div className="text-gray-500 text-[10px] uppercase mb-1">Current Intensity</div>
                  <div className="flex items-baseline">
                    <span className="text-xl font-mono font-bold text-white mr-2">{focusedStormStats.currentWind}</span>
                    <span className="text-xs text-gray-400">kt</span>
                  </div>
                  <div className={`text-sm font-bold ${focusedStormStats.categoryColor}`}>
                    {focusedStormStats.currentCategory}
                  </div>
                </div>

                {/* Peak Intensity */}
                <div className="bg-black/40 rounded-lg p-3 border border-white/5">
                  <div className="text-gray-500 text-[10px] uppercase mb-1">Peak Intensity</div>
                  <div className="flex items-baseline">
                    <span className="text-xl font-mono font-bold text-white mr-2">{focusedStormStats.peakWind}</span>
                    <span className="text-xs text-gray-400">kt</span>
                  </div>
                  <div className={`text-sm font-bold ${focusedStormStats.peakCategoryColor}`}>
                    {focusedStormStats.peakCategory}
                  </div>
                </div>
              </div>

              {/* ✅ FEATURE 3: SEMANTIC EXPLANATION LAYER */}
              <div className="pt-3 border-t border-white/10 space-y-4">
                
                {/* Lifecycle Phase */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-xs uppercase">Storm Phase</span>
                    <span className={`text-sm font-bold ${focusedStormStats.lifecycleColor}`}>
                      {focusedStormStats.lifecyclePhase}
                    </span>
                  </div>
                  <div className="text-xs text-gray-300 leading-relaxed bg-black/30 p-3 rounded border border-white/5">
                    {focusedStormStats.lifecycleDescription}
                    {focusedStormStats.windChange !== 0 && (
                      <span className="block mt-1 font-mono">
                        Wind change: {focusedStormStats.windChange > 0 ? '+' : ''}{focusedStormStats.windChange} kt
                      </span>
                    )}
                  </div>
                </div>

                {/* Category Context */}
                <div className="space-y-2">
                  <div className="text-gray-500 text-xs uppercase">Threat Assessment</div>
                  <div className="text-xs text-gray-300 leading-relaxed bg-black/30 p-3 rounded border border-white/5">
                    <div className="font-bold text-white mb-1">{focusedStormStats.currentCategory} IMPACT:</div>
                    {focusedStormStats.categoryContext}
                  </div>
                </div>

                {/* Operational Guidance */}
                <div className="space-y-2">
                  <div className="text-gray-500 text-xs uppercase">Operational Guidance</div>
                  <div className="text-xs text-gray-300 leading-relaxed bg-black/30 p-3 rounded border border-yellow-500/30">
                    <div className="flex items-start gap-2">
                      <span className="text-yellow-400">⚠️</span>
                      <span>
                        {focusedStormStats.currentCategory === 'Cat 5' || focusedStormStats.currentCategory === 'Cat 4'
                          ? 'Immediate course alteration required. Maintain 200nm minimum safe distance.'
                          : focusedStormStats.currentCategory === 'Cat 3'
                          ? 'Execute pre-planned diversion routes. Maintain 100nm buffer.'
                          : 'Increase watch frequency. Prepare for possible course adjustments.'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Stats */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="text-center">
                  <div className="text-gray-500 text-[10px] uppercase">Duration</div>
                  <div className="text-white font-mono font-bold">{focusedStormStats.daysActive}d</div>
                </div>
                <div className="text-center">
                  <div className="text-gray-500 text-[10px] uppercase">Peak %</div>
                  <div className={`text-sm font-bold ${focusedStormStats.currentWind >= focusedStormStats.peakWind ? 'text-red-400' : 'text-yellow-400'}`}>
                    {Math.round((focusedStormStats.currentWind / focusedStormStats.peakWind) * 100)}%
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-gray-500 text-[10px] uppercase">Tracking</div>
                  <div className="text-blue-400 text-sm font-bold">ACTIVE</div>
                </div>
              </div>

              {/* Close Button */}
              <button 
                onClick={() => setFocusedStormId(null)}
                className="w-full mt-4 py-2 bg-black/50 border border-white/10 rounded text-xs text-gray-400 hover:text-white hover:border-white/20 transition-colors"
              >
                Clear Focus & Resume Auto-tracking
              </button>
            </div>

            {/* ✅ FEATURE 4: IMPACT FORECAST (Updated) */}
            <div>
              <h2 className="text-blue-400 text-xs font-bold tracking-[0.2em] mb-4">IMPACT FORECAST</h2>
              
              {/* Threat Level Indicator */}
              <div className={`mb-4 p-4 rounded-xl border ${getSeverityBorderColor(impactAnalysis.severity)} bg-black/40`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-xs uppercase">Threat Level</span>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getSeverityColor(impactAnalysis.severity)}`}>
                    {impactAnalysis.severity}
                  </div>
                </div>
                <div className="text-sm font-mono font-bold text-white mb-1">
                  {impactAnalysis.count} VESSEL{impactAnalysis.count !== 1 ? 'S' : ''} AT RISK
                </div>
                {impactAnalysis.majorHurricaneThreat && (
                  <div className="text-xs text-red-400 font-bold flex items-center gap-2 mt-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    MAJOR HURRICANE THREAT DETECTED
                  </div>
                )}
              </div>

              {/* Strategic Advisory (SITREP) */}
              <div className="mb-6">
                <div className="text-gray-400 text-xs uppercase mb-2">Strategic Advisory</div>
                <div className="text-xs text-gray-300 leading-relaxed bg-black/30 p-4 rounded-xl border border-white/5">
                  <div className="font-bold text-white mb-2">SITUATION REPORT:</div>
                  <p>{impactAnalysis.sitrep}</p>
                  {impactAnalysis.threateningStorms && impactAnalysis.threateningStorms.length > 0 && (
                    <div className="mt-2 text-[11px] text-gray-400">
                      Threat sources: {impactAnalysis.threateningStorms.join(', ')}
                    </div>
                  )}
                </div>
              </div>

              {/* Impact Metrics */}
              <div className="space-y-4">
                <MetricCard 
                  label="Vessels at Risk" 
                  value={impactAnalysis.count.toString()} 
                  color={impactAnalysis.severity === 'CRITICAL' ? "text-red-500" : 
                         impactAnalysis.severity === 'MODERATE' ? "text-orange-400" : "text-white"} 
                />
                <MetricCard label="Est. Fleet Delay" value={`+${estimatedDelay}h`} color={impactAnalysis.count > 0 ? getSeverityTextColor(impactAnalysis.severity) : "text-gray-500"} />
                <MetricCard label="Est. Cost Surge" value={`$${estimatedCost}M`} color={impactAnalysis.count > 0 ? getSeverityTextColor(impactAnalysis.severity) : "text-gray-500"} />
                {impactAnalysis.totalCargoValue && impactAnalysis.totalCargoValue > 0 && (
                  <MetricCard label="Cargo Value at Risk" value={cargoRiskValue} color={getSeverityTextColor(impactAnalysis.severity)} />
                )}
              </div>
            </div>
          </div>
        ) : (
          /* DEFAULT VIEW: Enhanced Impact Forecast */
          <div>
            <h2 className="text-blue-400 text-xs font-bold tracking-[0.2em] mb-4">IMPACT FORECAST</h2>
            
            {/* Threat Level Indicator */}
            <div className={`mb-6 p-4 rounded-xl border ${getSeverityBorderColor(impactAnalysis.severity)} bg-black/40`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-xs uppercase">Global Threat Level</span>
                <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getSeverityColor(impactAnalysis.severity)}`}>
                  {impactAnalysis.severity}
                </div>
              </div>
              <div className="text-sm font-mono font-bold text-white mb-1">
                {impactAnalysis.count} VESSEL{impactAnalysis.count !== 1 ? 'S' : ''} AT RISK
              </div>
              {impactAnalysis.majorHurricaneThreat && (
                <div className="text-xs text-red-400 font-bold flex items-center gap-2 mt-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  MAJOR HURRICANE THREAT DETECTED
                </div>
              )}
            </div>

            {/* Strategic Advisory (SITREP) */}
            <div className="mb-6">
              <div className="text-gray-400 text-xs uppercase mb-2">Strategic Advisory</div>
              <div className="text-xs text-gray-300 leading-relaxed bg-black/30 p-4 rounded-xl border border-white/5">
                <div className="font-bold text-white mb-2">SITUATION REPORT:</div>
                <p>{impactAnalysis.sitrep}</p>
                {impactAnalysis.threateningStorms && impactAnalysis.threateningStorms.length > 0 && (
                  <div className="mt-2 text-[11px] text-gray-400">
                    Threat sources: {impactAnalysis.threateningStorms.join(', ')}
                  </div>
                )}
              </div>
            </div>

            {/* Impact Metrics */}
            <div className="space-y-4">
              <MetricCard 
                label="Vessels at Risk" 
                value={impactAnalysis.count.toString()} 
                color={impactAnalysis.severity === 'CRITICAL' ? "text-red-500" : 
                       impactAnalysis.severity === 'MODERATE' ? "text-orange-400" : "text-white"} 
              />
              <MetricCard label="Est. Fleet Delay" value={`+${estimatedDelay}h`} color={impactAnalysis.count > 0 ? getSeverityTextColor(impactAnalysis.severity) : "text-gray-500"} />
              <MetricCard label="Est. Cost Surge" value={`$${estimatedCost}M`} color={impactAnalysis.count > 0 ? getSeverityTextColor(impactAnalysis.severity) : "text-gray-500"} />
              {impactAnalysis.totalCargoValue && impactAnalysis.totalCargoValue > 0 && (
                <MetricCard label="Cargo Value at Risk" value={cargoRiskValue} color={getSeverityTextColor(impactAnalysis.severity)} />
              )}
            </div>

            {/* Focus Hint */}
            {mode === 'HISTORICAL' && (
              <div className="p-4 bg-slate-900/50 border border-white/5 rounded-lg mt-6">
                <div className="text-gray-500 text-[10px] uppercase mb-2">INTELLIGENCE PROTOCOL</div>
                <p className="text-gray-400 text-xs leading-relaxed">
                  Select any hurricane to access detailed lifecycle analysis, threat assessment, and operational guidance.
                </p>
                <div className="mt-3 text-[10px] text-gray-500">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <span>CRITICAL — Immediate action required</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                    <span>MODERATE — Enhanced monitoring</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span>LOW — Routine operations</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string, value: string, color: string }) {
  return <div className="p-3 bg-gray-900/50 rounded-lg border border-white/5"><div className="text-gray-500 text-[10px] uppercase mb-1">{label}</div><div className={`text-xl font-mono font-bold ${color}`}>{value}</div></div>;
}