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

// ✅ FEATURE 3: Category Context Helper
const getCategoryContext = (category: string): string => {
  switch (category) {
    case 'Cat 5':
      return 'CATASTROPHIC. Total fleet avoidance required. Critical structural damage likely.';
    case 'Cat 4':
      return 'EXTREME. Severe structural damage risk. All non-essential vessels must divert.';
    case 'Cat 3':
      return 'MAJOR. Small vessels capsize. High waves, dangerous conditions.';
    case 'Cat 2':
      return 'MODERATE-HIGH. Rough seas, risk to navigation. Exercise extreme caution.';
    case 'Cat 1':
      return 'MODERATE. Rough seas. Standard naval operating procedures apply.';
    case 'TS':
      return 'LOW. Minor drift issues. Increased watchkeeping advised.';
    case 'TD':
      return 'MINIMAL. Monitoring advised. Maintain normal operations.';
    default:
      return 'Status unclear. Proceed with standard caution.';
  }
};

// ✅ FEATURE 3: Lifecycle Phase Helper
const getLifecyclePhase = (
  currentWind: number,
  previousWind: number | null,
  peakWind: number,
  isActive: boolean
): { phase: string; color: string } => {
  if (!isActive) {
    return { phase: 'DISSIPATED', color: 'text-gray-400' };
  }
  
  // If at peak or very close to it
  if (currentWind >= peakWind - 5) {
    return { phase: 'PEAK INTENSITY', color: 'text-purple-400' };
  }
  
  // Determine trend if we have previous wind data
  if (previousWind !== null) {
    const windDifference = currentWind - previousWind;
    
    if (windDifference > 5) {
      return { phase: 'RAPID INTENSIFICATION', color: 'text-red-500' };
        } else if (windDifference > 1) {
      return { phase: 'INTENSIFYING', color: 'text-red-400' };
        } else if (windDifference < -5) {
      return { phase: 'RAPID WEAKENING', color: 'text-green-500' };
        } else if (windDifference < -1) {
      return { phase: 'WEAKENING', color: 'text-green-400' };
        }
  }
  
  // Default case
  return { phase: 'STABLE', color: 'text-yellow-400' };
};

// ✅ FEATURE 3: Lifecycle Phase Description Helper
const getLifecycleDescription = (phase: string): string => {
  switch (phase) {
    case 'RAPID INTENSIFICATION':
      return 'Storm is rapidly gaining strength. Immediate risk assessment required.';
    case 'INTENSIFYING':
      return 'Storm is gaining strength. Increasing risk to maritime operations.';
    case 'PEAK INTENSITY':
      return 'Storm at maximum observed strength. Maximum threat level active.';
    case 'STABLE':
      return 'Storm intensity holding steady. Maintain current operational posture.';
    case 'WEAKENING':
      return 'Storm is losing strength. Gradual reduction in threat level.';
    case 'RAPID WEAKENING':
      return 'Storm is rapidly deteriorating. Threat level decreasing quickly.';
    case 'DISSIPATED':
      return 'Storm no longer poses significant threat. Returning to normal operations.';
    default:
      return 'Monitoring storm development.';
  }
};

// ✅ FEATURE 5: Season Classification Helper
const getSeasonClassification = (stormCount: number): string => {
  if (stormCount < 12) return 'Quiet Season';
  if (stormCount >= 12 && stormCount <= 19) return 'Active Season';
  return 'EXTREME / HYPER-ACTIVE';
};

// ✅ FEATURE 5: Season Classification Color Helper
const getSeasonClassificationColor = (classification: string): string => {
  switch (classification) {
    case 'EXTREME / HYPER-ACTIVE': return 'text-red-500';
    case 'Active Season': return 'text-orange-400';
    case 'Quiet Season': return 'text-green-400';
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

  /* ✅ FEATURE 5: ENHANCED SEASON STATS */
  const seasonStats = useMemo(() => {
    if (!allData || !allData[selectedYear]) return null;
    let maxWind = 0;
    let strongestStorm = '';
    let totalTrackPoints = 0;
    let majorHurricanesCount = 0;
    const regionCounts = { Gulf: 0, Atlantic: 0, Caribbean: 0 };
    const stormNames: string[] = [];

    // ✅ REFACTOR: Collect all dates first to avoid TS "never" errors
    const allDates: Date[] = [];

    allData[selectedYear].forEach(s => {
      stormNames.push(s.name);
      s.track.forEach(p => {
        if (p.wind > maxWind) {
          maxWind = p.wind;
          strongestStorm = s.name;
        }
        if (p.wind >= 96) { // Cat 3+
          majorHurricanesCount++;
        }
        if (p.lat > 18 && p.lat < 30 && p.lng < -80) regionCounts.Gulf++;
        else if (p.lat < 22 && p.lng > -88 && p.lng < -60) regionCounts.Caribbean++;
        else regionCounts.Atlantic++;
        
        totalTrackPoints++;
        allDates.push(new Date(p.time));
      });
    });

    // Sort to find exact season boundaries
    allDates.sort((a, b) => a.getTime() - b.getTime());
    const firstStormDate = allDates.length > 0 ? allDates[0] : null;
    const lastStormDate = allDates.length > 0 ? allDates[allDates.length - 1] : null;

    const count = allData[selectedYear].length;
    const classification = getSeasonClassification(count);
    const classificationColor = getSeasonClassificationColor(classification);
    const dominantRegion = Object.keys(regionCounts).reduce((a, b) => 
      regionCounts[a as keyof typeof regionCounts] > regionCounts[b as keyof typeof regionCounts] ? a : b
    );

    // Calculate average storm duration (in days)
    const avgDuration = count > 0 ? Math.round((totalTrackPoints / count) / 4) : 0;

    // Calculate season duration in months
    let seasonDuration = '';
    if (firstStormDate && lastStormDate) {
      const monthDiff = (lastStormDate.getMonth() - firstStormDate.getMonth() + 
                        (lastStormDate.getFullYear() - firstStormDate.getFullYear()) * 12) + 1;
      seasonDuration = `${monthDiff} month${monthDiff !== 1 ? 's' : ''}`;
    }

    return {
      totalStorms: count,
      maxWind,
      strongestStorm,
      classification,
      classificationColor,
      dominantRegion,
      stormNames,
      majorHurricanesCount,
      avgDuration,
      seasonDuration,
      firstStormDate,
      lastStormDate,
      // Additional metrics for display
      seasonIntensity: maxWind >= 150 ? 'Record Breaking' : maxWind >= 130 ? 'Extreme' : maxWind >= 100 ? 'High' : 'Moderate',
      majorHurricaneRatio: count > 0 ? Math.round((majorHurricanesCount / count) * 100) : 0,
    };
  }, [allData, selectedYear]);

  /* ✅ FEATURE 2 & 3: FOCUSED STORM STATS with Lifecycle Analysis */
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

    // Find current wind and previous wind for lifecycle analysis
    const currentWind = focusedStorm.wind || 0;
    let previousWind: number | null = null;
    
    // Find the track segment we're currently in
    const t = currentDate.getTime();
    for (let i = 0; i < originalStorm.track.length - 1; i++) {
      const p1 = originalStorm.track[i];
      const p2 = originalStorm.track[i + 1];
      const t1 = new Date(p1.time).getTime();
      const t2 = new Date(p2.time).getTime();

      if (t >= t1 && t <= t2) {
        // Use the previous point's wind for trend analysis
        previousWind = p1.wind;
        break;
      }
    }

    // Determine if storm is active (wind > 0)
    const isActive = currentWind > 0;
    
    // ✅ FEATURE 3: Calculate lifecycle phase
    const currentCategory = getStormCategory(currentWind);
    const peakCategory = getStormCategory(peakWind);
    const { phase: lifecyclePhase, color: lifecycleColor } = getLifecyclePhase(
      currentWind,
      previousWind,
      peakWind,
      isActive
    );
    
    const lifecycleDescription = getLifecycleDescription(lifecyclePhase);
    const categoryContext = getCategoryContext(currentCategory);

    // Calculate days active (rough estimate based on track length)
    const daysActive = originalStorm.track.length > 0 
      ? Math.ceil(originalStorm.track.length / 4) 
      : 0;

    return {
      id: focusedStorm.id,
      name: focusedStorm.name,
      year: focusedStorm.year || selectedYear,
      currentWind,
      currentCategory,
      categoryColor: getCategoryColor(currentCategory),
      peakWind,
      peakCategory,
      peakCategoryColor: getCategoryColor(peakCategory),
      status: isActive ? 'ACTIVE' : 'DISSIPATED',
      daysActive,
      trackPoints: originalStorm.track.length,
      isActive,
      // ✅ FEATURE 3: New fields for lifecycle and context
      lifecyclePhase,
      lifecycleColor,
      lifecycleDescription,
      categoryContext,
      // Additional data for context
      previousWind,
      windChange: previousWind !== null ? currentWind - previousWind : 0,
    };
  }, [focusedStormId, activeStorms, allData, selectedYear, currentDate]);

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
    // ✅ FEATURE 2 & 3: Export focused storm stats
    focusedStormStats,
    getStormCategory,
  };
}