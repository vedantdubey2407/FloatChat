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
    <div className="w-full h-screen bg-gradient-to-br from-slate-950 to-black flex overflow-hidden">

      {/* LEFT TOOLBAR */}
      <aside className="w-72 bg-slate-900/90 border-r border-white/10 pt-24 pb-4 px-4 flex flex-col gap-6 shadow-xl">
        <h1 className="text-blue-400 font-extrabold tracking-widest text-xs uppercase">
          Nexus Architect
        </h1>

        <section className="space-y-2">
          <label className="text-gray-500 text-[10px] uppercase tracking-wider">
            Control Mode
          </label>
          <ToolButton label="Select / Move" active={selectedTool === 'SELECT'} onClick={() => setSelectedTool('SELECT')} icon="👆" />
        </section>

        <section className="space-y-2">
          <label className="text-gray-500 text-[10px] uppercase tracking-wider">
            Spawn Assets
          </label>
          <ToolButton label="Place Ship" active={selectedTool === 'SHIP'} onClick={() => setSelectedTool('SHIP')} icon="🚢" />
          <ToolButton label="Spawn Storm" active={selectedTool === 'STORM'} onClick={() => setSelectedTool('STORM')} icon="🌪️" />
          <ToolButton label="Piracy Zone" active={selectedTool === 'PIRACY'} onClick={() => setSelectedTool('PIRACY')} icon="🏴‍☠️" />
          <ToolButton label="Political Zone" active={selectedTool === 'POLITICAL'} onClick={() => setSelectedTool('POLITICAL')} icon="🏛️" />
        </section>

        <div className="mt-auto bg-black/50 border border-white/10 p-3 rounded-lg text-[11px] text-gray-400">
          <p>
            Active Tool:{' '}
            <span className="text-blue-400 font-bold">{selectedTool}</span>
          </p>
          {selectedTool === 'SELECT' && selectedEntityId ? (
            <p className="text-green-400 mt-1">Item selected — click map to move</p>
          ) : (
            <p className="mt-1">
              {selectedTool === 'SELECT'
                ? 'Select an entity to reposition'
                : 'Click on globe to deploy'}
            </p>
          )}
        </div>
      </aside>

      {/* CENTER GLOBE */}
      <main className={`flex-1 relative ${selectedTool !== 'SELECT' ? 'cursor-crosshair' : 'cursor-default'}`}>
        <TacticalGlobe
          activeScenario={null}
          scenarioMarkers={visualEntities}
          onGlobeClick={handleGlobeClick}
          onStormSelect={handleEntitySelect}
        />

        <div className="absolute top-24 left-4">
          <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-md text-xs text-white border border-white/10 shadow">
            Active Entities: <span className="text-blue-400 font-bold">{entities.length}</span>
          </div>
        </div>
      </main>

      {/* RIGHT PANEL */}
    <aside className="w-104 bg-slate-900/90 border-l border-white/10 pt-24 pb-4 px-4 flex flex-col shadow-xl min-h-0">

        <h2 className="text-blue-400 font-extrabold tracking-widest text-xs uppercase mb-3">
          Intelligence Feed
        </h2>

        <div className="bg-black/40 p-4 rounded-lg border border-white/5 h-36 overflow-y-auto mb-4">
          {interactions.length === 0 ? (
            <div className="text-gray-500 text-xs text-center mt-6">
              System All Clear
            </div>
          ) : (
            interactions.map(i => (
              <div key={i.id} className="text-xs mb-2 p-2 bg-red-900/20 border border-red-500/30 rounded">
                <strong className="text-red-400 block">{i.type} DETECTED</strong>
                <span className="text-gray-300">{i.description}</span>
              </div>
            ))
          )}
        </div>

        <button
          onClick={triggerAI}
          disabled={isAnalyzing}
          className={`w-full py-3 rounded-lg text-sm font-extrabold tracking-wide transition ${
            isAnalyzing
              ? 'bg-gray-700 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 shadow-lg'
          }`}
        >
          {isAnalyzing ? 'ANALYZING SNAPSHOT…' : 'GENERATE AI SITREP'}
        </button>

        {aiAnalysis && (
          <div className="flex-1 mt-4 bg-black/50 p-4 rounded-lg border border-white/10 overflow-y-auto">
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown
                components={{
                  h2: props => <h2 className="text-blue-400 uppercase tracking-wider mt-4 mb-2" {...props} />,
                  h3: props => <h3 className="text-white uppercase mt-3 mb-1" {...props} />,
                  strong: props => <strong className="bg-blue-900/30 px-1 rounded" {...props} />,
                }}
              >
                {aiAnalysis}
              </ReactMarkdown>
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
}

function ToolButton({ label, active, onClick, icon }: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition ${
        active
          ? 'bg-blue-600 text-white shadow scale-[1.02]'
          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
      }`}
    >
      <span className="text-lg">{icon}</span>
      {label}
    </button>
  );
}
