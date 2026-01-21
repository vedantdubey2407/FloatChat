'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import {
  Search,
  Info,
  Thermometer,
  Anchor,
  Waves,
  Map as MapIcon,
  Box,
  Globe,
  ChevronRight,
  AlertCircle,
  Database,
  MapPin,
  Droplets,
  Zap,
  X,
  RefreshCw,
  Download,
  Share2,
  BookOpen,
  Layers,
  Navigation,
  Clock,
  BarChart,
  Filter,
  Activity
} from 'lucide-react';

// Client-only globe
const SpeciesGlobe = dynamic(
  () => import('@/components/SpeciesGlobe'),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }
);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface SpeciesData {
  scientific_name: string;
  common_name: string;
  habitat_type: string;
  depth_range: string;
  temperature_preference: string;
  educational_brief: string;
  detailed_explanation: string;
}

interface MapPoint {
  lat: number;
  lng: number;
  label?: string;
  color?: string;
  type?: string;
  details?: any;
}

interface SuitabilityResult {
  status: string;
  score: 'HIGH' | 'MEDIUM' | 'LOW';
  live_temp: number;
  bio_range: string;
  reason: string;
  factors?: any;
}

interface ApiError {
  message: string;
  status?: number;
}

export default function SpeciesPanel() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SpeciesData | null>(null);
  const [viewMode, setViewMode] = useState<'3D' | 'MAP'>('3D');
  const [mapPoints, setMapPoints] = useState<MapPoint[]>([]);
  const [obsCount, setObsCount] = useState(0);
  const [suitability, setSuitability] = useState<SuitabilityResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState<string | null>(null);
  const [errors, setErrors] = useState<ApiError[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [timeRange, setTimeRange] = useState<'all' | 'recent' | 'historical'>('all');

  const exampleSpecies = [
    { name: 'Aurelia aurita', emoji: '🐙', type: 'Jellyfish' },
    { name: 'Carcharodon carcharias', emoji: '🦈', type: 'Shark' },
    { name: 'Chelonia mydas', emoji: '🐢', type: 'Turtle' },
    { name: 'Manta birostris', emoji: '🐋', type: 'Ray' },
    { name: 'Physeter macrocephalus', emoji: '🐳', type: 'Whale' },
    { name: 'Tursiops truncatus', emoji: '🐬', type: 'Dolphin' }
  ];

  const addError = useCallback((error: ApiError) => {
    setErrors(prev => [...prev.slice(-2), error]); // Keep only last 2 errors
  }, []);

  const clearError = useCallback((index: number) => {
    setErrors(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setData(null);
    setMapPoints([]);
    setObsCount(0);
    setSuitability(null);
    setViewMode('3D');
    setErrors([]);

    try {
      // Update search history
      setSearchHistory(prev => [query, ...prev.filter(q => q !== query).slice(0, 4)]);

      // 1. Fetch Biology
      const res = await fetch(`${API_BASE_URL}/species-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      if (!res.ok) {
        throw new Error(`Biology API error: ${res.status}`);
      }

      const bio = await res.json();
      setData(bio);

      // 2. Fetch Map Data
      const mapRes = await fetch(`${API_BASE_URL}/species-map`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      if (!mapRes.ok) {
        throw new Error(`Map API error: ${mapRes.status}`);
      }

      const mapData = await mapRes.json();

      if (mapData?.points?.length > 0) {
        setMapPoints(mapData.points);
        setObsCount(mapData.count);
        setViewMode('MAP');
      } else if (mapData.error) {
        addError({ message: mapData.error });
      }
    } catch (err: any) {
      console.error('Search failed', err);
      addError({ 
        message: err.message || 'Failed to fetch species data. Please try again.',
        status: 500 
      });
    } finally {
      setLoading(false);
      setActiveSuggestion(null);
    }
  };

  const handleAnalyzeHabitat = async () => {
    if (!data || mapPoints.length === 0) return;
    
    setAnalyzing(true);
    setSuitability(null);
    setErrors([]);

    // Use median point for analysis
    const targetPoint = mapPoints[Math.floor(mapPoints.length / 2)];

    try {
      const res = await fetch(`${API_BASE_URL}/analyze-suitability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          species_temp_str: data.temperature_preference,
          lat: targetPoint.lat,
          lng: targetPoint.lng
        })
      });

      if (!res.ok) {
        throw new Error(`Analysis API error: ${res.status}`);
      }

      const result = await res.json();
      setSuitability(result);
    } catch (error: any) {
      console.error("Suitability analysis failed", error);
      addError({ 
        message: error.message || 'Habitat analysis failed. Please try again.',
        status: 500 
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleQuickSearch = (species: string) => {
    setQuery(species);
    setActiveSuggestion(species);
    setTimeout(() => {
      const form = document.querySelector('form');
      if (form) {
        const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(submitEvent);
      }
    }, 100);
  };

  const handleExportData = async () => {
    if (!data) return;
    
    setExporting(true);
    try {
      const exportData = {
        species: data,
        observations: {
          count: obsCount,
          points: mapPoints
        },
        suitability: suitability,
        timestamp: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.scientific_name.replace(' ', '_')}_${new Date().getTime()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed', error);
      addError({ message: 'Export failed. Please try again.' });
    } finally {
      setExporting(false);
    }
  };

  const handleShare = async () => {
    if (!data) return;
    
    const shareData = {
      title: `${data.common_name} (${data.scientific_name})`,
      text: `Check out ${data.common_name} on the Marine Knowledge Engine`,
      url: window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        console.error('Share failed', error);
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareData.url);
      alert('Link copied to clipboard!');
    }
  };

  const getScoreColor = (score: 'HIGH' | 'MEDIUM' | 'LOW') => {
    switch (score) {
      case 'HIGH': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'MEDIUM': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'LOW': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getScoreEmoji = (score: 'HIGH' | 'MEDIUM' | 'LOW') => {
    switch (score) {
      case 'HIGH': return '🌊';
      case 'MEDIUM': return '🌡️';
      case 'LOW': return '🚫';
      default: return '❓';
    }
  };

  // Filter points based on time range
  const filteredPoints = useCallback(() => {
    if (timeRange === 'all') return mapPoints;
    
    const now = new Date();
    const currentYear = now.getFullYear();
    
    return mapPoints.filter(point => {
      if (!point.details?.date) return true;
      const year = parseInt(point.details.date.substring(0, 4));
      if (isNaN(year)) return true;
      
      if (timeRange === 'recent') {
        return year >= currentYear - 5;
      } else if (timeRange === 'historical') {
        return year < currentYear - 5;
      }
      return true;
    });
  }, [mapPoints, timeRange]);

  // Auto-detect view mode when data loads
  useEffect(() => {
    if (mapPoints.length > 0) {
      setViewMode('MAP');
    } else if (data) {
      setViewMode('3D');
    }
  }, [mapPoints.length, data]);

  return (
    <div className="w-full min-h-screen bg-slate-950 text-white flex flex-col px-4 md:px-6 pb-6 pt-16 md:pt-24 overflow-hidden relative">
      {/* Background gradients */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-blue-950/50 to-slate-950 -z-10" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.1),transparent_50%)] -z-10" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(6,182,212,0.05),transparent_50%)] -z-10" />
      
      {/* Animated orbs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse delay-1000" />

      {/* HEADER */}
      <header className="max-w-7xl mx-auto w-full mb-6 md:mb-8 shrink-0 relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-2 rounded-xl shadow-lg">
              <Globe className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
                Marine Knowledge Engine
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                Scientific intelligence for ocean biodiversity • Real-time habitat analysis
              </p>
            </div>
          </div>
          
          {/* Phase indicators */}
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-sm border border-slate-800 px-3 py-1.5 rounded-lg">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-gray-300">BIOLOGY</span>
            </div>
            <div className="flex items-center gap-2 bg-teal-900/30 backdrop-blur-sm border border-teal-800/50 px-3 py-1.5 rounded-lg">
              <div className="w-2 h-2 bg-teal-400 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-teal-300">OBIS DATA</span>
            </div>
            <div className="flex items-center gap-2 bg-indigo-900/30 backdrop-blur-sm border border-indigo-800/50 px-3 py-1.5 rounded-lg">
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-indigo-300">HABITAT</span>
            </div>
          </div>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="relative mb-6">
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
            <div className="relative">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 z-10 transition-colors group-hover:text-blue-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search marine species (e.g., Aurelia aurita, Great White Shark, Blue Whale)"
                className="w-full bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-xl py-3.5 md:py-4 px-6 pl-12 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all shadow-lg placeholder:text-slate-500"
              />
              <button
                type="submit"
                disabled={loading}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium px-5 md:px-6 py-2.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-md flex items-center gap-2 group"
              >
                {loading ? (
                  <>
                    <span className="animate-spin">⟳</span>
                    <span className="hidden md:inline">Searching...</span>
                  </>
                ) : (
                  <>
                    Analyze
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </div>
          
          {/* Quick suggestions & History */}
          <div className="flex flex-wrap items-center justify-between gap-2 mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                <Zap className="w-3 h-3" />
                Quick search:
              </span>
              <div className="flex flex-wrap gap-2">
                {exampleSpecies.map((species) => (
                  <button
                    key={species.name}
                    type="button"
                    onClick={() => handleQuickSearch(species.name)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5 ${
                      activeSuggestion === species.name
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/50 scale-105'
                        : 'text-slate-400 hover:text-blue-300 bg-slate-800/50 hover:bg-slate-800 border-slate-700'
                    }`}
                  >
                    <span>{species.emoji}</span>
                    <span>{species.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Search History */}
            {searchHistory.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Recent:</span>
                <div className="flex gap-1">
                  {searchHistory.slice(0, 3).map((term, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleQuickSearch(term)}
                      className="text-xs text-slate-400 hover:text-blue-300 px-2 py-1 rounded hover:bg-slate-800/50 transition-colors"
                    >
                      {term.length > 15 ? `${term.substring(0, 15)}...` : term}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </form>
      </header>

      {/* Error Display */}
      {errors.length > 0 && (
        <div className="max-w-7xl mx-auto w-full mb-4">
          {errors.map((error, idx) => (
            <div 
              key={idx}
              className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-2 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className="text-sm text-red-300">{error.message}</span>
              </div>
              <button
                onClick={() => clearError(idx)}
                className="text-red-400 hover:text-red-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto w-full flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
        
        {/* LEFT COLUMN: VISUALIZER + STATS */}
        <div className="lg:col-span-1 flex flex-col gap-6 min-h-0">
          
          {/* VISUALIZER CONTAINER */}
          <div className="bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-800/50 h-64 lg:h-80 relative overflow-hidden group shadow-2xl shadow-blue-900/10">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 via-transparent to-cyan-900/5 pointer-events-none" />
            
            {/* TOGGLES */}
            <div className="absolute top-4 left-4 right-4 z-10 flex justify-between">
              <div className="flex bg-black/60 backdrop-blur-sm rounded-lg p-1 border border-white/10 shadow-lg">
                <button
                  onClick={() => setViewMode('3D')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md transition-all ${
                    viewMode === '3D'
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Box size={16} />
                  <span className="text-xs font-medium">3D View</span>
                </button>
                <button
                  disabled={mapPoints.length === 0}
                  onClick={() => mapPoints.length > 0 && setViewMode('MAP')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md transition-all ${
                    mapPoints.length === 0
                      ? 'opacity-40 cursor-not-allowed'
                      : viewMode === 'MAP'
                      ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <MapIcon size={16} />
                  <span className="text-xs font-medium">Global Map</span>
                </button>
              </div>
              
              {/* Status indicator */}
              {obsCount > 0 && (
                <div className="bg-teal-900/40 backdrop-blur-sm border border-teal-700/30 px-3 py-1.5 rounded-lg flex items-center gap-2">
                  <div className="w-2 h-2 bg-teal-400 rounded-full animate-pulse" />
                  <span className="text-xs font-medium text-teal-300">
                    {obsCount.toLocaleString()} records
                  </span>
                </div>
              )}
            </div>

            {/* 3D VIEW */}
            {viewMode === '3D' && (
              <div className="absolute inset-0 flex items-center justify-center text-center px-6">
                <div>
                  <div className="w-28 h-28 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/50 shadow-[0_0_40px_rgba(59,130,246,0.3)] animate-pulse">
                    <span className="text-5xl">🐠</span>
                  </div>
                  <p className="text-sm font-medium text-blue-400 uppercase tracking-widest mb-2">
                    3D Specimen Viewer
                  </p>
                  {obsCount === 0 && data && (
                    <p className="text-xs text-slate-500 mt-2 max-w-60 mx-auto">
                      Species found! Switch to map view for occurrence data
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* MAP VIEW */}
            {viewMode === 'MAP' && (
              <div className="absolute inset-0">
                <SpeciesGlobe markers={filteredPoints()} />
                
                {/* Map Controls Overlay */}
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none">
                  <div className="bg-black/60 backdrop-blur-sm border border-teal-500/30 px-3 py-1.5 rounded-lg text-sm text-teal-300 font-medium flex items-center gap-2">
                    <Database className="w-3 h-3" />
                    <span>OBIS: <span className="font-bold text-white">{obsCount.toLocaleString()}</span></span>
                  </div>
                  
                  {/* Time Filter */}
                  {obsCount > 0 && (
                    <div className="flex gap-1">
                      {(['all', 'recent', 'historical'] as const).map((range) => (
                        <button
                          key={range}
                          onClick={() => setTimeRange(range)}
                          className={`px-2 py-1 text-xs rounded border pointer-events-auto transition-all ${
                            timeRange === range
                              ? 'bg-blue-500/20 text-blue-300 border-blue-500/50'
                              : 'bg-black/60 text-slate-400 border-slate-700 hover:border-slate-600'
                          }`}
                        >
                          {range.charAt(0).toUpperCase() + range.slice(1)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* HABITAT ANALYZER */}
                {mapPoints.length > 0 && (
                  <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-2">
                    
                    {/* RESULT CARD */}
                    {suitability && (
                      <div className="bg-slate-900/90 backdrop-blur-md border border-white/20 p-4 rounded-xl w-72 shadow-2xl mb-2 animate-in slide-in-from-bottom-5">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                            <div className={`p-2 rounded-lg ${getScoreColor(suitability.score)}`}>
                              <span className="text-lg">{getScoreEmoji(suitability.score)}</span>
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-gray-300 uppercase tracking-widest">Habitat Suitability</h4>
                              <div className="text-xs text-slate-500">Live analysis</div>
                            </div>
                          </div>
                          <button 
                            onClick={() => setSuitability(null)} 
                            className="text-gray-500 hover:text-white transition-colors p-1 hover:bg-white/10 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`text-3xl ${getScoreColor(suitability.score).split(' ')[2]}`}>
                            {suitability.score === 'HIGH' ? '✅' : 
                             suitability.score === 'MEDIUM' ? '⚠️' : 
                             '⛔'}
                          </div>
                          <div className="flex-1">
                            <div className={`text-lg font-bold ${getScoreColor(suitability.score).split(' ')[2]}`}>
                              {suitability.score} MATCH
                            </div>
                            <div className="text-xs text-gray-400 flex items-center gap-2">
                              <span>🌡️ Live SST: {suitability.live_temp}°C</span>
                              <span className="text-gray-600">•</span>
                              <span>🎯 Range: {suitability.bio_range}</span>
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-slate-300 leading-tight border-t border-white/10 pt-3 mt-3">
                          {suitability.reason}
                        </p>
                        {suitability.factors && (
                          <div className="mt-3 pt-3 border-t border-white/10">
                            <div className="text-xs text-slate-500 mb-1">Factors considered:</div>
                            <div className="flex gap-2">
                              {Object.keys(suitability.factors).map(factor => (
                                <span key={factor} className="text-xs px-2 py-1 bg-slate-800/50 rounded">
                                  {factor}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ANALYZE BUTTON */}
                    <div className="flex gap-2">
                      <button 
                        onClick={handleAnalyzeHabitat}
                        disabled={analyzing}
                        className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-medium py-2.5 px-4 rounded-xl shadow-lg flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group"
                      >
                        {analyzing ? (
                          <>
                            <span className="animate-spin">⟳</span>
                            <span>Analyzing...</span>
                          </>
                        ) : (
                          <>
                            <Activity className="w-4 h-4" />
                            <span>Analyze Habitat</span>
                          </>
                        )}
                      </button>
                      
                      {/* Refresh button */}
                      {suitability && (
                        <button
                          onClick={handleAnalyzeHabitat}
                          disabled={analyzing}
                          className="p-2.5 rounded-xl border border-slate-700 hover:border-slate-600 disabled:opacity-50 transition-colors"
                          title="Re-analyze"
                        >
                          <RefreshCw className={`w-4 h-4 ${analyzing ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* STATS CARD */}
          {data && (
            <div className="bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-800/50 p-6 shadow-lg">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h2 className="text-xl font-bold text-white">{data.common_name}</h2>
                  <p className="italic text-blue-300 text-sm mt-1 flex items-center gap-2">
                    {data.scientific_name}
                    {obsCount > 0 && (
                      <span className="text-xs font-normal text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded-full">
                        Verified
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {obsCount > 0 && (
                    <div className="bg-blue-900/30 text-blue-300 text-xs font-medium px-3 py-1.5 rounded-full border border-blue-700/50 flex items-center gap-1.5">
                      <MapPin className="w-3 h-3" />
                      {obsCount} sightings
                    </div>
                  )}
                  <div className="flex gap-1">
                    <button
                      onClick={handleExportData}
                      disabled={exporting}
                      className="p-1.5 rounded-lg border border-slate-700 hover:border-slate-600 disabled:opacity-50 transition-colors"
                      title="Export data"
                    >
                      {exporting ? (
                        <span className="animate-spin">⟳</span>
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={handleShare}
                      className="p-1.5 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors"
                      title="Share"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <StatCard
                  icon={<Waves className="w-4 h-4" />}
                  title="Habitat"
                  value={data.habitat_type}
                  color="blue"
                />
                <StatCard
                  icon={<Anchor className="w-4 h-4" />}
                  title="Depth Range"
                  value={data.depth_range}
                  color="cyan"
                />
                <StatCard
                  icon={<Thermometer className="w-4 h-4" />}
                  title="Temperature"
                  value={data.temperature_preference}
                  color="orange"
                />
                <StatCard
                  icon={<Globe className="w-4 h-4" />}
                  title="Distribution"
                  value={obsCount > 0 ? `${obsCount.toLocaleString()} records` : 'Pending'}
                  color="teal"
                />
              </div>
              
              {/* Brief description */}
              {data.educational_brief && (
                <div className="mt-6 pt-5 border-t border-slate-800/50">
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-medium text-slate-300">Quick Facts</span>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {data.educational_brief}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: TEXT ANALYSIS */}
        {data && (
          <div className="lg:col-span-2 bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-800/50 p-6 md:p-8 overflow-y-auto custom-scrollbar shadow-lg">
            <div className="sticky top-0 bg-slate-900/80 backdrop-blur-sm z-10 pb-5 mb-6 border-b border-slate-800/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-2.5 rounded-xl text-white shadow-md">
                    <Info size={22} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      Ecological Analysis
                    </h3>
                    <p className="text-sm text-slate-400 mt-1">
                      Comprehensive habitat assessment and behavioral profile
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Layers className="w-4 h-4" />
                  <span>Scientific Report</span>
                </div>
              </div>
            </div>
            
            <div className="prose prose-invert prose-lg max-w-none 
                          prose-headings:text-blue-300 prose-headings:font-semibold
                          prose-strong:text-white prose-strong:font-semibold
                          prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:underline
                          prose-ul:my-4 prose-li:my-1
                          prose-p:text-slate-300 prose-p:leading-relaxed">
              <ReactMarkdown>
                {data.detailed_explanation}
              </ReactMarkdown>
            </div>
            
            {/* Data source note */}
            <div className="mt-8 p-5 bg-gradient-to-r from-yellow-900/10 via-amber-900/5 to-yellow-900/5 border border-yellow-700/30 rounded-xl">
              <div className="flex items-start gap-4">
                <div className="bg-yellow-500/20 p-2 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-yellow-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-300 mb-2">
                    Data Source & Limitations
                  </p>
                  <p className="text-sm text-yellow-500/90 leading-relaxed">
                    This analysis is based on established biological records from FishBase and OBIS databases. 
                    It provides ecological insights but does not constitute real-time population forecasting 
                    or conservation status assessment. Data accuracy depends on source database completeness.
                  </p>
                  <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-yellow-800/30">
                    <span className="text-xs text-yellow-600 flex items-center gap-1">
                      <Database className="w-3 h-3" />
                      Source: FishBase/OBIS
                    </span>
                    <span className="text-xs text-yellow-600 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Last updated: Recent
                    </span>
                    <span className="text-xs text-yellow-600 flex items-center gap-1">
                      <BarChart className="w-3 h-3" />
                      Confidence: High
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* EMPTY STATE */}
      {!data && !loading && (
        <div className="flex-1 flex items-center justify-center text-slate-600 relative">
          <div className="text-center max-w-2xl mx-auto px-4 py-12">
            <div className="relative mb-10">
              <div className="w-40 h-40 bg-gradient-to-br from-blue-900/20 to-cyan-900/10 rounded-full mx-auto flex items-center justify-center border-2 border-slate-800/50 shadow-2xl">
                <div className="relative">
                  <Globe className="w-24 h-24 text-slate-700 opacity-20" />
                  <div className="absolute inset-0 border-2 border-dashed border-blue-500/20 rounded-full animate-spin-slow" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500/30 to-cyan-500/30 rounded-full blur-xl" />
                </div>
              </div>
              
              {/* Floating elements */}
              <div className="absolute top-6 left-1/4 w-8 h-8 bg-blue-500/10 rounded-full animate-bounce" />
              <div className="absolute top-12 right-1/4 w-6 h-6 bg-cyan-500/10 rounded-full animate-bounce delay-300" />
            </div>
            
            <h3 className="text-2xl font-semibold text-slate-300 mb-4">
              Discover Marine Biodiversity
            </h3>
            <p className="text-slate-500 mb-8 text-lg leading-relaxed max-w-lg mx-auto">
              Enter a marine species name to begin comprehensive analysis. 
              Our engine retrieves biological data, global observations, 
              and habitat suitability metrics.
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-10">
              {exampleSpecies.map((species) => (
                <button
                  key={species.name}
                  onClick={() => handleQuickSearch(species.name)}
                  className="text-sm text-blue-400 hover:text-blue-300 bg-slate-900/50 hover:bg-slate-800/70 px-4 py-3 rounded-xl border border-slate-800 hover:border-blue-500/30 transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-blue-900/10 group text-left"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg">{species.emoji}</span>
                    <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div className="font-medium">{species.name.split(' ')[0]}</div>
                  <div className="text-xs text-slate-500 mt-1">{species.type}</div>
                  <div className="w-full h-px bg-gradient-to-r from-blue-500/0 via-blue-500/30 to-blue-500/0 mt-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500/50 rounded-full animate-pulse" />
                <span>Biological Data</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-teal-500/50 rounded-full animate-pulse delay-300" />
                <span>Global Observations</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-indigo-500/50 rounded-full animate-pulse delay-700" />
                <span>Habitat Analysis</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center">
            <div className="relative mb-6">
              <div className="w-20 h-20 border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Droplets className="w-8 h-8 text-blue-400 animate-pulse" />
              </div>
            </div>
            <p className="text-lg text-slate-300 font-medium">Retrieving marine data...</p>
            <p className="text-sm text-slate-500 mt-2">Querying biological databases and observation records</p>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="max-w-7xl mx-auto w-full mt-8 pt-6 border-t border-slate-800/50 text-center text-xs text-slate-600 relative z-10">
        <p className="flex items-center justify-center gap-2">
          <Navigation className="w-3 h-3" />
          Marine Knowledge Engine v1.0 • Data sourced from FishBase and OBIS • For research purposes
        </p>
      </footer>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  color: 'blue' | 'cyan' | 'orange' | 'teal';
}

function StatCard({ icon, title, value, color }: StatCardProps) {
  const colorClasses = {
    blue: 'text-blue-400 border-blue-500/20 bg-blue-500/10',
    cyan: 'text-cyan-400 border-cyan-500/20 bg-cyan-500/10',
    orange: 'text-orange-400 border-orange-500/20 bg-orange-500/10',
    teal: 'text-teal-400 border-teal-500/20 bg-teal-500/10'
  };
  
  return (
    <div className={`border rounded-xl p-4 transition-all hover:scale-[1.02] group ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-lg bg-${color}-500/20 group-hover:bg-${color}-500/30 transition-colors`}>
          <div className="text-current">
            {icon}
          </div>
        </div>
        <span className="text-sm font-medium text-slate-400 uppercase tracking-wide">
          {title}
        </span>
      </div>
      <p className="text-white font-semibold text-lg">{value}</p>
      <div className={`w-full h-px bg-gradient-to-r from-${color}-500/0 via-${color}-500/20 to-${color}-500/0 mt-3 opacity-0 group-hover:opacity-100 transition-opacity`} />
    </div>
  );
}