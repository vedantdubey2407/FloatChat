'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { MaritimeEntity, InteractionEvent } from '@/types/nexus';
// Ensure you have created this utility file, otherwise the app will crash
import { runSimulationTick } from '@/utils/nexusPhysics'; 

interface NexusContextType {
  entities: MaritimeEntity[];
  interactions: InteractionEvent[];
  addEntity: (entity: MaritimeEntity) => void;
  updateEntityPosition: (id: string, lat: number, lng: number) => void;
  removeEntity: (id: string) => void;
  snapshot: {
    timestamp: string;
    entities: MaritimeEntity[];
    active_interactions: InteractionEvent[];
    global_risk_score: number;
  }; 
}

const NexusContext = createContext<NexusContextType | undefined>(undefined);

export function NexusProvider({ children }: { children: React.ReactNode }) {
  const [entities, setEntities] = useState<MaritimeEntity[]>([]);
  const [interactions, setInteractions] = useState<InteractionEvent[]>([]);

  // Simulation Loop: Runs every second to check for collisions/risks
  useEffect(() => {
    const interval = setInterval(() => {
      // Run physics engine on current entities to detect conflicts
      const newInteractions = runSimulationTick(entities);
      setInteractions(newInteractions);
    }, 1000);

    return () => clearInterval(interval);
  }, [entities]);

  // --- ACTIONS ---

  const addEntity = (entity: MaritimeEntity) => {
    setEntities(prev => [...prev, entity]);
  };

  const updateEntityPosition = (id: string, lat: number, lng: number) => {
    setEntities(prev => prev.map(e => 
      e.id === id ? { ...e, position: { lat, lng } } : e
    ));
  };

  const removeEntity = (id: string) => {
    setEntities(prev => prev.filter(e => e.id !== id));
  };

  // --- DATA SNAPSHOT (For AI Analysis) ---
  const snapshot = {
    timestamp: new Date().toISOString(),
    entities: entities,
    active_interactions: interactions,
    // Calculate total risk score by summing severity of all active events
    global_risk_score: interactions.reduce((acc, curr) => acc + curr.severityScore, 0)
  };

  return (
    <NexusContext.Provider value={{ 
      entities, 
      interactions, 
      addEntity, 
      updateEntityPosition, 
      removeEntity, 
      snapshot 
    }}>
      {children}
    </NexusContext.Provider>
  );
}

export const useNexus = () => {
  const context = useContext(NexusContext);
  if (!context) throw new Error('useNexus must be used within a NexusProvider');
  return context;
};