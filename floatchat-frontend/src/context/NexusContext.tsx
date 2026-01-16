'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { MaritimeEntity, InteractionEvent } from '@/types/nexus';
import { runSimulationTick } from '@/utils/nexusPhysics';

interface NexusContextType {
  entities: MaritimeEntity[];
  interactions: InteractionEvent[];
  addEntity: (entity: MaritimeEntity) => void;
  // ✅ NEW: Ability to move/delete
  updateEntityPosition: (id: string, lat: number, lng: number) => void;
  removeEntity: (id: string) => void;
  snapshot: any; 
}

const NexusContext = createContext<NexusContextType | undefined>(undefined);

export function NexusProvider({ children }: { children: React.ReactNode }) {
  const [entities, setEntities] = useState<MaritimeEntity[]>([]);
  const [interactions, setInteractions] = useState<InteractionEvent[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      const newInteractions = runSimulationTick(entities);
      setInteractions(newInteractions);
    }, 1000);
    return () => clearInterval(interval);
  }, [entities]);

  const addEntity = (entity: MaritimeEntity) => {
    setEntities(prev => [...prev, entity]);
  };

  // ✅ NEW FUNCTION: Update Position
  const updateEntityPosition = (id: string, lat: number, lng: number) => {
    setEntities(prev => prev.map(e => 
      e.id === id ? { ...e, position: { lat, lng } } : e
    ));
  };

  // ✅ NEW FUNCTION: Delete
  const removeEntity = (id: string) => {
    setEntities(prev => prev.filter(e => e.id !== id));
  };

  const snapshot = {
    timestamp: new Date().toISOString(),
    entities: entities,
    active_interactions: interactions,
    global_risk_score: interactions.reduce((acc, curr) => acc + curr.severityScore, 0)
  };

  return (
    <NexusContext.Provider value={{ entities, interactions, addEntity, updateEntityPosition, removeEntity, snapshot }}>
      {children}
    </NexusContext.Provider>
  );
}

export const useNexus = () => {
  const context = useContext(NexusContext);
  if (!context) throw new Error('useNexus must be used within a NexusProvider');
  return context;
};