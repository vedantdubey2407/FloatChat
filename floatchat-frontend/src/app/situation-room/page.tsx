'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import { NexusProvider, useNexus } from '@/context/NexusContext';
import { MaritimeEntity, EntityType } from '@/types/nexus';

const TacticalGlobe = dynamic(() => import('@/components/TacticalGlobe'), { ssr: false });

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function SituationRoomContent() {
  const { entities, interactions, addEntity, updateEntityPosition, snapshot } = useNexus();
  
  const [selectedTool, setSelectedTool] = useState<EntityType | 'SELECT'>('SELECT');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleGlobeClick = (coords: { lat: number, lng: number }) => {
    if (selectedTool === 'SELECT') {
      if (selectedEntityId) {
        updateEntityPosition(selectedEntityId, coords.lat, coords.lng);
      }
      return;
    }

    const newId = `${selectedTool.toLowerCase()}-${Date.now()}`;

    const baseEntity: MaritimeEntity = {
      id: newId,
      type: selectedTool as EntityType,
      name: `${selectedTool} ${entities.filter(e => e.type === selectedTool).length + 1}`,
      isActive: true,
      position: coords,
      radiusNm: selectedTool === 'STORM' ? 300 : selectedTool === 'POLITICAL' ? 500 : 50,
      severity: 'MODERATE',
      attributes: { cargoValue: 100 }
    };

    if (selectedTool === 'POLITICAL') {
      baseEntity.name = 'Sanction Zone';
      baseEntity.severity = 'CRITICAL';
    }

    addEntity(baseEntity);
    setSelectedEntityId(newId);
  };

  const handleEntitySelect = (id: string) => {
    setSelectedEntityId(id);
    setSelectedTool('SELECT');
  };

  const visualEntities = entities.map(e => ({
    ...e,
    isSelected: e.id === selectedEntityId
  }));

  const triggerAI = async () => {
    setIsAnalyzing(true);
    setAiAnalysis(null);

    try {
      const payload = {
        entities: snapshot.entities,
        active_interactions: snapshot.active_interactions,
        global_risk_score: snapshot.global_risk_score
      };

      const response = await fetch(`${API_BASE_URL}/analyze-situation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(`AI Uplink Failed: ${response.statusText}`);
      const data = await response.json();
      setAiAnalysis(data.analysis);

    } catch (error) {
      setAiAnalysis(`
## SYSTEM OFFLINE
Connection to Nexus Intelligence failed.

${String(error)}
      `);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="w-full h-screen bg-gradient-to-br from-gray-950 via-black to-blue-950/30 flex overflow-hidden relative">
      {/* Subtle grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />
      
      {/* Glowing orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />

      {/* LEFT TOOLBAR - Enhanced Tactical Panel */}
      <aside className="w-80 bg-gradient-to-b from-gray-900/95 to-black/95 border-r border-white/10 pt-24 pb-4 px-5 flex flex-col gap-8 shadow-2xl backdrop-blur-sm z-20">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-6 bg-gradient-to-b from-cyan-500 to-blue-500 rounded-full" />
            <h1 className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400 font-bold tracking-widest text-sm uppercase">
              Nexus Command Interface
            </h1>
          </div>
          <p className="text-gray-400 text-[10px] tracking-widest font-medium">TACTICAL CONTROL PANEL v2.1</p>
        </div>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
            <label className="text-gray-400 text-[10px] uppercase tracking-wider font-bold whitespace-nowrap">
              Control Mode
            </label>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
          </div>
          <ToolButton 
            label="Select / Move" 
            active={selectedTool === 'SELECT'} 
            onClick={() => setSelectedTool('SELECT')} 
            icon="👆"
            description="Select and reposition entities"
          />
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
            <label className="text-gray-400 text-[10px] uppercase tracking-wider font-bold whitespace-nowrap">
              Deploy Assets
            </label>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ToolButton label="Ship" active={selectedTool === 'SHIP'} onClick={() => setSelectedTool('SHIP')} icon="🚢" variant="ship" />
            <ToolButton label="Storm" active={selectedTool === 'STORM'} onClick={() => setSelectedTool('STORM')} icon="🌪️" variant="storm" />
            <ToolButton label="Piracy" active={selectedTool === 'PIRACY'} onClick={() => setSelectedTool('PIRACY')} icon="🏴‍☠️" variant="piracy" />
            <ToolButton label="Political" active={selectedTool === 'POLITICAL'} onClick={() => setSelectedTool('POLITICAL')} icon="🏛️" variant="political" />
          </div>
        </section>

        {/* Status Panel */}
        <div className="mt-auto space-y-4">
          <div className="bg-gradient-to-r from-gray-900/80 to-black/80 p-4 rounded-xl border border-white/10 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-[10px] uppercase tracking-wider">Active Tool</span>
              <span className="text-cyan-400 font-bold text-sm animate-pulse">{selectedTool}</span>
            </div>
            <div className="text-xs text-gray-300 space-y-1">
              {selectedTool === 'SELECT' && selectedEntityId ? (
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-green-400">Item selected — click map to move</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full" />
                  <span>
                    {selectedTool === 'SELECT'
                      ? 'Select an entity to reposition'
                      : 'Click on globe to deploy'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Entity Counter */}
          <div className="bg-gradient-to-r from-black/60 to-gray-900/60 p-3 rounded-lg border border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-[10px] uppercase tracking-wider">Active Entities</span>
              <span className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                {entities.length}
              </span>
            </div>
            <div className="h-1 w-full bg-gray-800 rounded-full mt-2 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(entities.length * 10, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </aside>

      {/* CENTER GLOBE - Enhanced with HUD Elements */}
      <main className={`flex-1 relative ${selectedTool !== 'SELECT' ? 'cursor-crosshair' : 'cursor-default'}`}>
        <TacticalGlobe
          activeScenario={null}
          scenarioMarkers={visualEntities}
          onGlobeClick={handleGlobeClick}
          onStormSelect={handleEntitySelect}
        />

        {/* HUD Overlay */}
        <div className="absolute top-6 left-6 right-6">
          <div className="flex items-center justify-between">
            <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm text-gray-300">System Status: <span className="text-green-400 font-bold">OPERATIONAL</span></span>
              </div>
            </div>
            
            <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 shadow-2xl">
              <div className="text-sm">
                <span className="text-gray-400">Risk Level: </span>
                <span className="text-yellow-400 font-bold">ELEVATED</span>
              </div>
            </div>
          </div>
        </div>

        {/* Coordinates Display */}
        <div className="absolute bottom-6 left-6 bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 shadow-2xl">
          <div className="text-xs text-gray-400">Click coordinates to deploy</div>
        </div>
      </main>

      {/* RIGHT PANEL - Enhanced Intelligence Display */}
      <aside className="w-96 bg-gradient-to-b from-gray-900/95 to-black/95 border-l border-white/10 pt-24 pb-6 px-6 flex flex-col shadow-2xl backdrop-blur-sm z-20">
        <div className="space-y-1 mb-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-6 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full" />
            <h2 className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 font-bold tracking-widest text-sm uppercase">
              Intelligence Console
            </h2>
          </div>
          <p className="text-gray-400 text-[10px] tracking-widest font-medium">REAL-TIME THREAT MONITOR</p>
        </div>

        {/* Threat Feed */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs text-gray-400 uppercase tracking-wider font-bold">Active Threats</h3>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${interactions.length > 0 ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
              <span className="text-xs text-gray-400">{interactions.length} alerts</span>
            </div>
          </div>
          
          <div className="bg-gradient-to-b from-black/40 to-gray-900/40 p-4 rounded-xl border border-white/5 h-48 overflow-y-auto space-y-2">
            {interactions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500">
                <div className="w-8 h-8 border-2 border-gray-600 rounded-full flex items-center justify-center mb-2">
                  <div className="w-4 h-4 border-2 border-gray-600 rounded-full" />
                </div>
                <p className="text-xs tracking-widest">ALL SYSTEMS NOMINAL</p>
                <p className="text-[10px] mt-1">No active threats detected</p>
              </div>
            ) : (
              interactions.map(i => (
                <div 
                  key={i.id} 
                  className="p-3 rounded-lg bg-gradient-to-r from-red-900/20 to-transparent border-l-4 border-red-500 backdrop-blur-sm animate-fadeIn"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <strong className="text-red-400 text-xs uppercase tracking-wider">{i.type}</strong>
                    <span className="text-gray-500 text-[10px] ml-auto">{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <p className="text-gray-300 text-xs">{i.description}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* AI Analysis Button */}
        <button
          onClick={triggerAI}
          disabled={isAnalyzing}
          className={`group relative w-full py-4 rounded-xl text-sm font-bold tracking-wider transition-all duration-300 overflow-hidden mb-6 ${
            isAnalyzing
              ? 'bg-gradient-to-r from-gray-800 to-gray-900 cursor-not-allowed'
              : 'bg-gradient-to-r from-cyan-600/20 to-blue-600/20 hover:from-cyan-600/30 hover:to-blue-600/30 active:scale-[0.98]'
          }`}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="relative flex items-center justify-center gap-3">
            {isAnalyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-cyan-300">ANALYZING SITUATION…</span>
              </>
            ) : (
              <>
                <div className="w-5 h-5 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-sm rotate-45" />
                <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  GENERATE AI SITREP
                </span>
              </>
            )}
          </div>
        </button>

        {/* AI Analysis Output */}
        {aiAnalysis && (
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs text-gray-400 uppercase tracking-wider font-bold">AI Analysis Report</h3>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
                <span className="text-xs text-cyan-400">LIVE</span>
              </div>
            </div>
            
            <div className="flex-1 bg-gradient-to-b from-black/40 to-gray-900/40 p-5 rounded-xl border border-white/5 overflow-y-auto">
              <div className="prose prose-invert prose-sm max-w-none space-y-3">
                <ReactMarkdown
                  components={{
                    h2: ({children}) => (
                      <h2 className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-300 uppercase tracking-wider text-sm border-b border-white/10 pb-2 mb-3">
                        {children}
                      </h2>
                    ),
                    h3: ({children}) => (
                      <h3 className="text-white uppercase text-xs mt-4 mb-2 tracking-wider">
                        {children}
                      </h3>
                    ),
                    strong: ({children}) => (
                      <strong className="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 px-2 py-0.5 rounded">
                        {children}
                      </strong>
                    ),
                    p: ({children}) => (
                      <p className="text-gray-300 text-sm leading-relaxed">
                        {children}
                      </p>
                    ),
                    ul: ({children}) => (
                      <ul className="space-y-2 pl-4 border-l border-white/10">
                        {children}
                      </ul>
                    ),
                    li: ({children}) => (
                      <li className="text-gray-300 text-sm flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full mt-2 flex-shrink-0" />
                        {children}
                      </li>
                    ),
                  }}
                >
                  {aiAnalysis}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

export default function SituationRoomPage() {
  return (
    <NexusProvider>
      <SituationRoomContent />
    </NexusProvider>
  );
}

interface ToolButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: string;
  description?: string;
  variant?: 'ship' | 'storm' | 'piracy' | 'political' | 'default';
}

function ToolButton({ label, active, onClick, icon, description, variant = 'default' }: ToolButtonProps) {
  const variantStyles = {
    ship: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
    storm: 'from-purple-500/20 to-indigo-500/20 border-purple-500/30',
    piracy: 'from-red-500/20 to-orange-500/20 border-red-500/30',
    political: 'from-yellow-500/20 to-amber-500/20 border-yellow-500/30',
    default: 'from-gray-800 to-gray-900 border-gray-700'
  };

  return (
    <button
      onClick={onClick}
      className={`group relative w-full p-3 rounded-xl border transition-all duration-300 text-left overflow-hidden ${
        active
          ? `bg-gradient-to-r ${variantStyles[variant]} scale-[1.02] shadow-lg shadow-current/10`
          : 'bg-gradient-to-r from-gray-800/50 to-gray-900/50 border-white/5 hover:border-white/10 hover:scale-[1.01]'
      }`}
    >
      {active && (
        <div className="absolute inset-0 bg-gradient-to-r from-current/5 to-transparent animate-pulse" />
      )}
      
      <div className="relative flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl backdrop-blur-sm ${
          active 
            ? 'bg-white/10' 
            : 'bg-black/30'
        }`}>
          {icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className={`font-bold text-sm ${
              active ? 'text-white' : 'text-gray-300'
            }`}>
              {label}
            </span>
            {active && (
              <div className="w-2 h-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full animate-pulse" />
            )}
          </div>
          {description && (
            <p className="text-gray-400 text-[10px] mt-1 leading-tight">{description}</p>
          )}
        </div>
      </div>
    </button>
  );
}