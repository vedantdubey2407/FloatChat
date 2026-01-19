import { MaritimeEntity, InteractionEvent, GeoPoint } from '@/types/nexus';

// Helper: Haversine Distance (Nautical Miles)
function getDistance(p1: GeoPoint, p2: GeoPoint): number {
  if (!p1 || !p2) return 99999; // Safety guard
  
  const R = 3440.065; // Earth radius in NM
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// 🧠 THE SIMULATION LOOP
export function runSimulationTick(entities: MaritimeEntity[]): InteractionEvent[] {
  const interactions: InteractionEvent[] = [];
  const ships = entities.filter(e => e.type === 'SHIP');
  const threats = entities.filter(e => e.type !== 'SHIP');

  ships.forEach(ship => {
    // Safety check: ensure ship has a position
    if (!ship.position) return;

    threats.forEach(threat => {
      // Safety check: ensure threat has a position
      if (!threat.position) return;

      const dist = getDistance(ship.position, threat.position);
      
      // 1. STORM / BLOCKAGE LOGIC (Physical Radius Check)
      // We add a small buffer (+10nm) for safety margins
      if ((threat.type === 'STORM' || threat.type === 'BLOCKAGE') && dist < (threat.radiusNm + 10)) {
        interactions.push({
          id: `${ship.id}-${threat.id}`,
          entityA: ship.name,
          entityB: threat.name,
          type: 'COLLISION',
          severityScore: threat.severity === 'CRITICAL' ? 90 : 50,
          description: `Vessel inside ${threat.name} radius (${Math.round(dist)}nm).`,
          timestamp: Date.now()
        });
      }

      // 2. POLITICAL / PIRACY LOGIC (Zone Entry)
      if ((threat.type === 'PIRACY' || threat.type === 'POLITICAL') && dist < threat.radiusNm) {
        
        // LOGIC A: POLITICAL ZONES (Sanctions)
        if (threat.type === 'POLITICAL') {
           interactions.push({
            id: `${ship.id}-${threat.id}-pol`,
            entityA: ship.name,
            entityB: threat.name,
            type: 'SANCTION_VIOLATION',
            severityScore: 100, // Maximum Severity
            description: `Sanctioned vessel entered restricted zone ${threat.name}.`,
            timestamp: Date.now()
          });
        } 
        // LOGIC B: PIRACY ZONES (Hostile Area)
        else {
           interactions.push({
            id: `${ship.id}-${threat.id}`,
            entityA: ship.name,
            entityB: threat.name,
            type: 'ZONE_ENTRY',
            severityScore: 75,
            description: `Vessel entered hostile piracy zone ${threat.name}.`,
            timestamp: Date.now()
          });
        }
      }
    });
  });

  return interactions;
}