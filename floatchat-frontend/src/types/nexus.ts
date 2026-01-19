export type EntityType = 
  | 'SHIP' 
  | 'ROUTE' 
  | 'STORM' 
  | 'PIRACY' 
  | 'ICE' 
  | 'BLOCKAGE' 
  | 'POLITICAL';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface MaritimeEntity {
  id: string;
  type: EntityType;
  name: string;
  isActive: boolean;
  position: GeoPoint;
  radiusNm: number;       
  
  // Metadata
  severity: 'LOW' | 'MODERATE' | 'CRITICAL';
  
  // Extensible Attributes
  // ✅ UPDATE: Added index signature to allow dynamic AI properties
  attributes: {
    windSpeed?: number;      
    cargoValue?: number;     
    flagState?: string;      
    sanctionedBy?: string[]; 
    [key: string]: any; // <--- Allows extra custom properties (Critical for Situation Room)
  };
}

export interface InteractionEvent {
  id: string;
  entityA: string; 
  entityB: string; 
  type: 'COLLISION' | 'ZONE_ENTRY' | 'SANCTION_VIOLATION' | 'NEAR_MISS';
  severityScore: number; 
  description: string;
  timestamp: number;
}