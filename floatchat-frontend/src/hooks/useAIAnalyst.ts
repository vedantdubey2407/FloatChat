'use client';

import { useState, useCallback } from 'react';

interface StormPayload {
  name: string;
  wind: number;
  lat: number;
  lng: number;
  category: string;
  lifecycle: string;
  affected_ships: number;
}

interface AnalysisResult {
  status: string;
  sitrep: string;
  metadata?: {
    storm_name: string;
    analysis_timestamp: number;
    threat_level: string;
    recommended_response: string;
  };
  error?: string;
}

interface UseAIAnalystReturn {
  analyzeStorm: (data: StormPayload) => Promise<void>;
  analysisResult: AnalysisResult | null;
  isAnalyzing: boolean;
  error: string | null;
  clearAnalysis: () => void;
}

export function useAIAnalyst(): UseAIAnalystReturn {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeStorm = useCallback(async (data: StormPayload) => {
    setIsAnalyzing(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:8000/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      const result: AnalysisResult = await response.json();
      setAnalysisResult(result);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      
      // Fallback mock response if backend is unavailable
      setAnalysisResult({
        status: "simulated_analysis",
        sitrep: `## ⚡ SIMULATED SITREP: ${data.name}\n\n**Threat Assessment:** ${data.category} storm posing risk to ${data.affected_ships} vessels.\n\n**Recommended Action:** Maintain safe distance of ${data.wind >= 64 ? '100nm' : '50nm'}.\n\n*Note: Backend AI service unavailable. This is a simulated response.*`,
        metadata: {
          storm_name: data.name,
          analysis_timestamp: Date.now(),
          threat_level: data.wind >= 96 ? "CRITICAL" : data.wind >= 64 ? "HIGH" : "MODERATE",
          recommended_response: "Monitor and maintain distance"
        }
      });
      
      console.error('AI Analysis Error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const clearAnalysis = useCallback(() => {
    setAnalysisResult(null);
    setError(null);
  }, []);

  return {
    analyzeStorm,
    analysisResult,
    isAnalyzing,
    error,
    clearAnalysis,
  };
}