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

const STEP_MS = 6 * 60 * 60 * 1000;

// ✅ FEATURE 2: Saffir-Simpson Category Helper
const getStormCategory = (wind: number): string => {
  if (wind >= 137) return 'Cat 5';
  if (wind >= 113) return 'Cat 4';
  if (wind >= 96) return 'Cat 3';
  if (wind >= 83) return 'Cat 2';
  if (wind >= 64) return 'Cat 1';
  if (wind >= 34) return 'TS';
  return 'TD';
};

// ✅ FEATURE 2: Category colors for UI
const getCategoryColor = (category: string): string => {
  switch (category) {
    case 'Cat 5': return 'text-purple-400';
    case 'Cat 4': return 'text-red-500';
    case 'Cat 3': return 'text-red-400';
    case 'Cat 2': return 'text-orange-500';
    case 'Cat 1': return 'text-yellow-500';
    case 'TS': return 'text-yellow-300';
    case 'TD': return 'text-blue-300';
    default: return 'text-gray-400';
  }
};

export function useHurricanePlayback() {
  const [allData, setAllData] = useState<Record<string, Storm[]> | null>(null);
  const [selectedYear, setSelectedYear] = useState(2005);
  const [currentDate, setCurrentDate] = useState(new Date(2005, 5, 1));
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(100);

  // ✅ FEATURE 1: State for the currently focused storm
  const [focusedStormId, setFocusedStormId] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  /* LOAD DATA */
  useEffect(() => {
    fetch('/hurricanes.json')
      .then(res => res.json())
      .then(setAllData)
      .catch(console.error);
  }, []);

  /* PLAYBACK LOOP */
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!isPlaying) return;

    timerRef.current = setInterval(() => {
      setCurrentDate(prev => {
        const next = new Date(prev.getTime() + STEP_MS);
        if (next.getFullYear() > selectedYear) {
          setIsPlaying(false);
          return prev;
        }
        return next;
      });
    }, playbackSpeed);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, selectedYear, playbackSpeed]);

  /* RESET ON YEAR CHANGE */
  useEffect(() => {
    setCurrentDate(new Date(selectedYear, 5, 1));
    setIsPlaying(false);
    setFocusedStormId(null); // Reset focus when year changes
  }, [selectedYear]);

  /* AVAILABLE YEARS */
  const availableYears = useMemo(() => {
    if (!allData) return [];
    return Object.keys(allData).map(Number).sort((a, b) => b - a);
  }, [allData]);

  /* ACTIVE STORMS */
  const activeStorms = useMemo(() => {
    if (!allData || !allData[selectedYear]) return [];
    const t = currentDate.getTime();

    return allData[selectedYear].flatMap(storm => {
      const track = storm.track;
      for (let i = 0; i < track.length - 1; i++) {
        const p1 = track[i];
        const p2 = track[i + 1];
        const t1 = new Date(p1.time).getTime();
        const t2 = new Date(p2.time).getTime();

        if (t >= t1 && t <= t2) {
          const progress = (t - t1) / (t2 - t1);
          const wind = Math.round(p1.wind + (p2.wind - p1.wind) * progress);
          const category = getStormCategory(wind);

          let color = '#3b82f6';
          if (wind >= 34) color = '#f59e0b';
          if (wind >= 64) color = '#ef4444';
          if (wind >= 96) color = '#a855f7';

          return [{
            id: storm.id,
            name: storm.name,
            year: storm.year,
            lat: p1.lat + (p2.lat - p1.lat) * progress,
            lng: p1.lng + (p2.lng - p1.lng) * progress,
            wind,
            category,
            radius: wind * 0.4,
            color,
            fullTrack: storm.track
          }];
        }
      }
      return [];
    });
  }, [allData, selectedYear, currentDate]);

  /* SEASON STATS */
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

  /* ✅ FEATURE 2: FOCUSED STORM STATS */
  const focusedStormStats = useMemo(() => {
    if (!focusedStormId || !activeStorms.length) return null;
    
    const focusedStorm = activeStorms.find(storm => storm.id === focusedStormId);
    if (!focusedStorm) return null;

    // Get the original storm data to calculate peak stats
    const originalStorm = allData?.[selectedYear]?.find(storm => storm.id === focusedStormId);
    
    if (!originalStorm) return null;

    // Calculate peak wind from full track history
    let peakWind = 0;
    originalStorm.track.forEach(point => {
      if (point.wind > peakWind) {
        peakWind = point.wind;
      }
    });

    // Determine status
    const currentWind = focusedStorm.wind || 0;
    const status = currentWind > 0 ? 'ACTIVE' : 'DISSIPATED';
    
    // Calculate days active (rough estimate based on track length)
    const daysActive = originalStorm.track.length > 0 
      ? Math.ceil(originalStorm.track.length / 4) 
      : 0;

    return {
      id: focusedStorm.id,
      name: focusedStorm.name,
      year: focusedStorm.year || selectedYear,
      currentWind,
      currentCategory: getStormCategory(currentWind),
      categoryColor: getCategoryColor(getStormCategory(currentWind)),
      peakWind,
      peakCategory: getStormCategory(peakWind),
      peakCategoryColor: getCategoryColor(getStormCategory(peakWind)),
      status,
      daysActive,
      trackPoints: originalStorm.track.length,
      // For visual indicators
      isActive: currentWind > 0,
      intensityChange: currentWind >= peakWind ? 'Peaking' : 'Weakening',
    };
  }, [focusedStormId, activeStorms, allData, selectedYear]);

  return {
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
    focusedStormId,
    setFocusedStormId,
    // ✅ FEATURE 2: Export focused storm stats
    focusedStormStats,
    // ✅ FEATURE 2: Export helper function if needed elsewhere
    getStormCategory,
  };
}