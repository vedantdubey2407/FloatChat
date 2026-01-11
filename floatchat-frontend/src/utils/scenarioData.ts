export const SCENARIO_DATA = {
  pirates: [
    {
      id: "pirate-1",
      lat: 12.5,
      lng: 48.0,
      type: "PIRATE",
      severity: "CRITICAL",
      label: "Skiff Sighting - Alpha"
    },
    {
      id: "pirate-2",
      lat: 13.2,
      lng: 49.5,
      type: "PIRATE",
      severity: "CRITICAL",
      label: "Hijack Attempt"
    },
    {
      id: "pirate-3",
      lat: 11.8,
      lng: 51.2,
      type: "PIRATE",
      severity: "MODERATE",
      label: "Suspicious Trawler"
    },
    {
      id: "pirate-4",
      lat: 14.1,
      lng: 53.4,
      type: "PIRATE",
      severity: "CRITICAL",
      label: "Skiff Swarm"
    },
    {
      id: "pirate-5",
      lat: 12.9,
      lng: 47.1,
      type: "PIRATE",
      severity: "MODERATE",
      label: "Mothership Radar Contact"
    }
  ],
  suez: [
    {
      id: "blockage-main",
      lat: 30.5852,
      lng: 32.2654,
      type: "BLOCKAGE",
      severity: "CRITICAL",
      label: "VESSEL GROUNDED (Blocking Traffic)"
    },
    {
      id: "queue-1",
      lat: 29.9,
      lng: 32.5,
      type: "SHIP_QUEUE",
      severity: "MODERATE",
      label: "Waiting: MV Al-Zubara (LNG)"
    },
    {
      id: "queue-2",
      lat: 29.7,
      lng: 32.6,
      type: "SHIP_QUEUE",
      severity: "MODERATE",
      label: "Waiting: Cosco Galaxy (Container)"
    },
    {
      id: "queue-3",
      lat: 29.5,
      lng: 32.4,
      type: "SHIP_QUEUE",
      severity: "MODERATE",
      label: "Waiting: Frontline Spirit (Tanker)"
    },
    {
      id: "queue-4",
      lat: 29.3,
      lng: 32.7,
      type: "SHIP_QUEUE",
      severity: "MODERATE",
      label: "Waiting: Evergreen A-Class"
    }
  ],
  arctic: [
    { id: "ice-0", lat: 72.0, lng: -160.0, type: "ICE_EDGE", severity: "LOW", label: "Ice Limit" },
    { id: "ice-1", lat: 73.5, lng: -140.0, type: "ICE_EDGE", severity: "LOW", label: "Ice Limit" },
    { id: "ice-2", lat: 74.0, lng: -120.0, type: "ICE_EDGE", severity: "LOW", label: "Ice Limit" },
    { id: "ice-3", lat: 72.0, lng: -100.0, type: "ICE_EDGE", severity: "LOW", label: "Ice Limit" },
    { id: "ice-4", lat: 70.0, lng: -80.0, type: "ICE_EDGE", severity: "MODERATE", label: "Ice Limit" },
    { id: "ice-5", lat: 68.0, lng: -60.0, type: "ICE_EDGE", severity: "CRITICAL", label: "Pack Ice Warning" },
    { id: "ice-6", lat: 69.0, lng: -40.0, type: "ICE_EDGE", severity: "CRITICAL", label: "Pack Ice Warning" },
    { id: "ice-7", lat: 70.0, lng: -20.0, type: "ICE_EDGE", severity: "MODERATE", label: "Ice Limit" },
    { id: "ice-8", lat: 75.0, lng: 0.0, type: "ICE_EDGE", severity: "LOW", label: "Ice Limit" },
    { id: "ice-9", lat: 76.0, lng: 20.0, type: "ICE_EDGE", severity: "LOW", label: "Ice Limit" },
    { id: "ice-10", lat: 75.0, lng: 40.0, type: "ICE_EDGE", severity: "LOW", label: "Ice Limit" },
    { id: "ice-11", lat: 72.0, lng: 60.0, type: "ICE_EDGE", severity: "MODERATE", label: "Ice Limit" },
    { id: "ice-12", lat: 70.0, lng: 80.0, type: "ICE_EDGE", severity: "CRITICAL", label: "Pack Ice Warning" }
  ]
};