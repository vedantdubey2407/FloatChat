'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

interface TrackPoint {
  time: string;
  lat: number;
  lng: number;
  wind: number;
  status: string;
}

interface Storm {
  id: string;
  name: string;
  year: number;
  track: TrackPoint[];
}

const STEP_MS = 6 * 60 * 60 * 1000; // 6 hours per tick

export function useHurricanePlayback() {
  const [allData, setAllData] = useState<Record<string, Storm[]> | null>(null);
  const [selectedYear, setSelectedYear] = useState(2005);
  const [currentDate, setCurrentDate] = useState(new Date(2005, 5, 1));
  const [isPlaying, setIsPlaying] = useState(false);
  
  // ✅ NEW: Speed State (Interval in ms). Lower = Faster.
  const [playbackSpeed, setPlaybackSpeed] = useState(100); 

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  /* ---------------- LOAD DATA ---------------- */
  useEffect(() => {
    fetch('/hurricanes.json')
      .then(res => res.json())
      .then(setAllData)
      .catch(console.error);
  }, []);

  /* ---------------- PLAYBACK LOOP ---------------- */
  useEffect(() => {
    // Clear existing timer if speed or playing state changes
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!isPlaying) return;

    // Start new timer with the selected speed
    timerRef.current = setInterval(() => {
      setCurrentDate(prev => {
        const next = new Date(prev.getTime() + STEP_MS);

        if (next.getFullYear() > selectedYear) {
          setIsPlaying(false);
          return prev;
        }
        return next;
      });
    }, playbackSpeed); // ✅ Uses dynamic speed

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPlaying, selectedYear, playbackSpeed]); // ✅ Re-run when speed changes

  /* ---------------- RESET ON YEAR CHANGE ---------------- */
  useEffect(() => {
    setCurrentDate(new Date(selectedYear, 5, 1));
    setIsPlaying(false);
  }, [selectedYear]);

  /* ---------------- DERIVED DATA ---------------- */
  const availableYears = useMemo(() => {
    if (!allData) return [];
    return Object.keys(allData).map(Number).sort((a, b) => b - a);
  }, [allData]);

  const activeStorms = useMemo(() => {
    if (!allData || !allData[selectedYear]) return [];
    const t = currentDate.getTime();

    return allData[selectedYear].flatMap(storm => {
      const track = storm.track;
      if (!track.length) return [];

      // Optimize: Only check storms active in this year
      // Find the segment for the current time
      for (let i = 0; i < track.length - 1; i++) {
        const p1 = track[i];
        const p2 = track[i + 1];
        const t1 = new Date(p1.time).getTime();
        const t2 = new Date(p2.time).getTime();

        if (t >= t1 && t <= t2) {
          const progress = (t - t1) / (t2 - t1);
          const wind = Math.round(p1.wind + (p2.wind - p1.wind) * progress);

          let color = '#3b82f6';
          if (wind >= 34) color = '#f59e0b';
          if (wind >= 64) color = '#ef4444';
          if (wind >= 96) color = '#a855f7';

          return [{
            id: storm.id,
            name: storm.name,
            lat: p1.lat + (p2.lat - p1.lat) * progress,
            lng: p1.lng + (p2.lng - p1.lng) * progress,
            wind,
            radius: wind * 0.4,
            color,
            fullTrack: storm.track,
          }];
        }
      }
      return [];
    });
  }, [allData, selectedYear, currentDate]);

  const seasonStats = useMemo(() => {
    if (!allData || !allData[selectedYear]) return null;
    let maxWind = 0;
    let strongestStorm = '';
    const regionCounts = { Gulf: 0, Atlantic: 0, Caribbean: 0 };

    allData[selectedYear].forEach(s =>
      s.track.forEach(p => {
        if (p.wind > maxWind) {
          maxWind = p.wind;
          strongestStorm = s.name;
        }
        if (p.lat > 18 && p.lat < 30 && p.lng < -80) regionCounts.Gulf++;
        else if (p.lat < 22 && p.lng > -88 && p.lng < -60) regionCounts.Caribbean++;
        else regionCounts.Atlantic++;
      })
    );

    const count = allData[selectedYear].length;
    const dominantRegion = Object.keys(regionCounts).reduce((a, b) => 
      regionCounts[a as keyof typeof regionCounts] > regionCounts[b as keyof typeof regionCounts] ? a : b
    );

    return {
      totalStorms: count,
      maxWind,
      strongestStorm,
      classification: count < 8 ? 'Quiet' : count > 18 ? 'EXTREME' : count > 12 ? 'Active' : 'Moderate',
      dominantRegion,
    };
  }, [allData, selectedYear]);

  return {
    activeStorms,
    currentDate,
    selectedYear,
    setSelectedYear,
    isPlaying,
    setIsPlaying,
    availableYears,
    seasonStats,
    playbackSpeed,    // ✅ Expose speed
    setPlaybackSpeed, // ✅ Expose setter
  };
}