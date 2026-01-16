'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import { NexusProvider, useNexus } from '@/context/NexusContext';
import { MaritimeEntity, EntityType } from '@/types/nexus';

const TacticalGlobe = dynamic(() => import('@/components/TacticalGlobe'), { ssr: false });

function SituationRoomContent() {
  // Get State & Actions from Context
  const { entities, interactions, addEntity, updateEntityPosition, snapshot } = useNexus();
  
  const [selectedTool, setSelectedTool] = useState<EntityType | 'SELECT'>('SELECT');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // 1. GLOBE CLICK HANDLER (Spawn OR Move)
  const handleGlobeClick = (coords: { lat: number, lng: number }) => {
    
    // CASE A: MOVE MODE
    if (selectedTool === 'SELECT') {
      if (selectedEntityId) {
        console.log("📍 Moving Entity:", selectedEntityId, "to", coords);
        updateEntityPosition(selectedEntityId, coords.lat, coords.lng);
      }
      return;
    }

    // CASE B: SPAWN MODE
    const newId = `${selectedTool.toLowerCase()}-${Date.now()}`;
    const baseEntity: MaritimeEntity = {
      id: newId,
      type: selectedTool,
      name: `${selectedTool} ${entities.filter(e => e.type === selectedTool).length + 1}`,
      isActive: true,
      position: coords,
      // Default Radii: Storm=300nm, Political=500nm, Others=50nm
      radiusNm: selectedTool === 'STORM' ? 300 : selectedTool === 'POLITICAL' ? 500 : 50,
      severity: 'MODERATE',
      attributes: { cargoValue: 100 }
    };

    if (selectedTool === 'POLITICAL') {
      baseEntity.name = "Sanction Zone";
      baseEntity.severity = 'CRITICAL';
    }

    addEntity(baseEntity);
    // Auto-select the new entity
    setSelectedEntityId(newId);
  };

  // 2. ENTITY CLICK HANDLER
  const handleEntitySelect = (id: string) => {
    console.log("✅ Selected Entity:", id);
    setSelectedEntityId(id);
    setSelectedTool('SELECT'); // Auto-switch to Select tool
  };

  // Helper to mark the selected entity visually
  const visualEntities = entities.map(e => ({
    ...e,
    isSelected: e.id === selectedEntityId
  }));

  // ✅ 3. REAL AI TRIGGER (UPDATED)
  const triggerAI = async () => {
    setIsAnalyzing(true);
    setAiAnalysis(null); // Clear old results

    try {
      // Prepare the Payload from Context Snapshot
      const payload = {
        entities: snapshot.entities,
        active_interactions: snapshot.active_interactions,
        global_risk_score: snapshot.global_risk_score
      };

      console.log("📡 Sending Snapshot to Nexus AI...", payload);

      // Call the Python Backend
      const response = await fetch('http://localhost:8000/analyze-situation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('AI Uplink Failed');

      const data = await response.json();
      
      // Display Real AI Result
      setAiAnalysis(data.analysis);

    } catch (error) {
      console.error("AI Error:", error);
      setAiAnalysis(`
## ⚠️ SYSTEM OFFLINE
**ERROR:** Unable to contact Nexus Intelligence Cloud.
**DETAILS:** ${error}

Please ensure the Python backend is running on port 8000.
      `);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="w-full h-screen bg-slate-950 flex overflow-hidden">
      
      {/* LEFT TOOLBAR */}
      <div className="w-64 bg-slate-900 border-r border-white/10 pt-24 pb-4 px-4 flex flex-col gap-4 z-10">
        <h1 className="text-blue-500 font-bold tracking-widest text-xs uppercase">NEXUS ARCHITECT</h1>
        
        <div className="space-y-2">
          <label className="text-gray-500 text-[10px] uppercase">Tools</label>
          <ToolButton label="Select / Move" active={selectedTool === 'SELECT'} onClick={() => setSelectedTool('SELECT')} icon="👆" />
        </div>
        
        <div className="space-y-2">
          <label className="text-gray-500 text-[10px] uppercase">Spawn Assets</label>
          <ToolButton label="Place Ship" active={selectedTool === 'SHIP'} onClick={() => setSelectedTool('SHIP')} icon="🚢" />
          <ToolButton label="Spawn Storm" active={selectedTool === 'STORM'} onClick={() => setSelectedTool('STORM')} icon="🌪️" />
          <ToolButton label="Piracy Zone" active={selectedTool === 'PIRACY'} onClick={() => setSelectedTool('PIRACY')} icon="🏴‍☠️" />
          <ToolButton label="Political Zone" active={selectedTool === 'POLITICAL'} onClick={() => setSelectedTool('POLITICAL')} icon="🏛️" />
        </div>

        <div className="mt-auto bg-black/40 p-3 rounded text-[10px] text-gray-400">
          <p>Active Tool: <span className="text-blue-400 font-bold">{selectedTool}</span></p>
          {selectedTool === 'SELECT' && selectedEntityId ? (
             <p className="text-green-400 animate-pulse">Item Selected. Click map to Move.</p>
          ) : (
             <p>{selectedTool === 'SELECT' ? "Click an item to select it." : "Click map to spawn item."}</p>
          )}
        </div>
      </div>

      {/* CENTER GLOBE */}
      <div className={`flex-1 relative bg-black ${selectedTool !== 'SELECT' ? 'cursor-crosshair' : 'cursor-default'}`}>
        <TacticalGlobe 
          activeScenario={null} 
          scenarioMarkers={visualEntities} 
          onGlobeClick={handleGlobeClick} 
          onStormSelect={handleEntitySelect} 
        />
        
        <div className="absolute top-24 left-4 pointer-events-none">
             <div className="bg-black/50 p-2 rounded text-xs text-white border border-white/10 backdrop-blur-md">
                Active Entities: <span className="font-bold text-blue-400">{entities.length}</span>
             </div>
        </div>
      </div>

      {/* RIGHT PANEL - INTELLIGENCE */}
      <div className="w-96 bg-slate-900 border-l border-white/10 pt-24 pb-4 px-4 flex flex-col z-10">
         <div className="mb-4">
          <h2 className="text-blue-500 font-bold tracking-widest text-xs uppercase mb-2">LIVE PHYSICS ENGINE</h2>
          <div className="bg-black/40 p-4 rounded border border-white/5 h-32 overflow-y-auto custom-scrollbar">
            {interactions.length === 0 ? (
              <div className="text-gray-500 text-xs text-center mt-4">System All Clear</div>
            ) : (
              interactions.map(i => (
                <div key={i.id} className="text-xs mb-2 p-2 bg-red-900/20 border border-red-500/30 rounded animate-pulse">
                  <strong className="text-red-400 block">{i.type} DETECTED</strong>
                  <span className="text-gray-300">{i.description}</span>
                </div>
              ))
            )}
          </div>
        </div>
        
        <button 
            onClick={triggerAI} 
            disabled={isAnalyzing} 
            className={`w-full py-3 text-white font-bold rounded mb-4 transition-all ${
                isAnalyzing ? 'bg-gray-700 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-lg'
            }`}
        >
            {isAnalyzing ? "ANALYZING SNAPSHOT..." : "GENERATE AI SITREP"}
        </button>
        
        {aiAnalysis && (
            <div className="flex-1 bg-black/40 p-4 rounded border border-white/10 font-mono text-xs overflow-y-auto custom-scrollbar">
                 <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown
                        components={{
                            h2: ({node, ...props}) => <h2 className="text-sm font-bold text-blue-400 mt-4 mb-2 uppercase tracking-wider" {...props} />,
                            h3: ({node, ...props}) => <h3 className="text-xs font-bold text-white mt-3 mb-1 uppercase" {...props} />,
                            strong: ({node, ...props}) => <strong className="text-white font-extrabold bg-blue-900/30 px-1 rounded" {...props} />,
                            li: ({node, ...props}) => <li className="pl-1 marker:text-blue-500" {...props} />,
                        }}
                    >
                        {aiAnalysis}
                    </ReactMarkdown>
                 </div>
            </div>
        )}
      </div>

    </div>
  );
}

// Wrapper to provide Context
export default function SituationRoomPage() {
  return (
    <NexusProvider>
      <SituationRoomContent />
    </NexusProvider>
  );
}

// Helper Components
function ToolButton({ label, active, onClick, icon }: any) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-2 rounded transition-all text-xs font-bold ${active ? 'bg-blue-600 text-white shadow-lg scale-105' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
    >
      <span className="text-lg">{icon}</span>
      {label}
    </button>
  );
}