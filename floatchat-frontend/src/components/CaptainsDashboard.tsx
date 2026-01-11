'use client';
import ReactMarkdown from 'react-markdown';
import { RouteData } from '../types/naval';

interface CaptainsDashboardProps {
  routeData: RouteData;
  activeTab: 'SUMMARY' | 'RISKS' | 'WEATHER' | 'DECISION';
  setActiveTab: (tab: 'SUMMARY' | 'RISKS' | 'WEATHER' | 'DECISION') => void;
  explaining: boolean;
  onClose: () => void;
}

export default function CaptainsDashboard({
  routeData,
  activeTab,
  setActiveTab,
  explaining,
  onClose
}: CaptainsDashboardProps) {
  return (
    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 w-[600px] bg-gray-900/95 backdrop-blur-xl border border-blue-500/50 rounded-xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-5">
      
      {/* HEADER */}
      <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-black/40">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-blue-100">{routeData.basic_info?.primary_route_name || 'Route'}</h3>
          <span className={`px-2 py-0.5 rounded text-[10px] font-black tracking-wider ${
            routeData.basic_info?.risk_level === 'DANGER' ? 'bg-red-600 text-white' : 
            routeData.basic_info?.risk_level === 'SAFE' ? 'bg-green-600 text-black' : 'bg-yellow-500 text-black'
          }`}>
            {routeData.basic_info?.risk_level || 'UNKNOWN'}
          </span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">✕</button>
      </div>

      {/* TABS */}
      <div className="flex border-b border-gray-700">
        {['SUMMARY', 'RISKS', 'WEATHER', 'DECISION'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`flex-1 py-2 text-xs font-bold transition-colors ${
              activeTab === tab ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'
            }`}
          >
            {tab === 'DECISION' ? '⚡ DECISION' : tab}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div className="p-4 min-h-[200px] max-h-[300px] overflow-y-auto custom-scrollbar">
        {activeTab === 'SUMMARY' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-gray-800/50 p-2 rounded text-center border border-gray-700">
                <div className="text-[10px] text-gray-500 uppercase">Distance</div>
                {/* ✅ FIXED: Added optional chaining and fallback */}
                <div className="text-xl font-mono text-white">
                  {routeData.basic_info?.distance_nm?.toLocaleString() ?? '0'} <span className="text-xs">nm</span>
                </div>
              </div>
              <div className="bg-gray-800/50 p-2 rounded text-center border border-gray-700">
                <div className="text-[10px] text-gray-500 uppercase">Time</div>
                {/* ✅ FIXED: Added optional chaining and fallback */}
                <div className="text-xl font-mono text-white">
                  {routeData.basic_info?.estimated_time_days ?? '0'} <span className="text-xs">days</span>
                </div>
              </div>
              <div className="bg-gray-800/50 p-2 rounded text-center border border-gray-700">
                <div className="text-[10px] text-gray-500 uppercase">Fuel Est.</div>
                {/* ✅ FIXED: Added robust nested check */}
                <div className="text-xl font-mono text-blue-400">
                  {routeData.good_to_have?.fuel_estimation?.estimated_fuel_tons ?? 'N/A'} <span className="text-xs">tons</span>
                </div>
              </div>
            </div>
            <div className="p-3 bg-blue-900/20 border border-blue-500/20 rounded text-sm text-gray-300">
              <strong className="text-blue-400 block mb-1">Captain's Summary:</strong>
              <ReactMarkdown>{routeData.captain_summary || "No summary available."}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* ... Rest of the component (RISKS, WEATHER, DECISION) remains the same ... */}
        {activeTab === 'RISKS' && (
          <div className="space-y-2">
            {routeData.risk_breakdown?.map((risk, i) => (
              <div key={i} className="flex items-start gap-3 p-2 rounded bg-gray-800/40 border border-gray-700">
                <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                  risk.severity === 'HIGH' ? 'bg-red-500 shadow-[0_0_8px_red]' : 
                  risk.severity === 'MEDIUM' ? 'bg-yellow-500' : 'bg-green-500'
                }`} />
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase">{risk.type} <span className="opacity-50">({risk.severity})</span></div>
                  <div className="text-sm text-gray-200">{risk.description}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'WEATHER' && routeData.weather_summary && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-gray-800 rounded border border-gray-600">
                <div className="text-xs text-gray-400">Avg Wave Height</div>
                <div className="text-lg font-bold text-blue-300">{routeData.weather_summary.avg_wave_height_m} m</div>
              </div>
              <div className="p-3 bg-gray-800 rounded border border-gray-600">
                <div className="text-xs text-gray-400">Wind Speed</div>
                <div className="text-lg font-bold text-blue-300">{routeData.weather_summary.avg_wind_speed_knots} kts</div>
              </div>
            </div>
            <div className="p-3 bg-gray-800/50 rounded border border-gray-700 text-sm">
              <strong className="block text-gray-400 text-xs uppercase mb-1">Weather Notes</strong>
              <p className="text-gray-300 italic">"{routeData.weather_summary.weather_notes}"</p>
            </div>
          </div>
        )}

        {activeTab === 'DECISION' && (
          <div className="space-y-4">
            {explaining ? (
              <div className="text-center py-6 text-yellow-200 animate-pulse">
                <div className="mb-2">⚡ Analyzing Strategic Alternatives...</div>
              </div>
            ) : routeData.decision_analysis ? (
              <>
                <div className="p-3 bg-green-900/20 border border-green-500/30 rounded">
                  <div className="text-[10px] text-green-400 uppercase font-bold mb-1">Why this route?</div>
                  <div className="text-sm text-gray-200">{routeData.decision_analysis.explain_route_decision.chosen_route_reason}</div>
                </div>
                <div className="p-3 bg-yellow-900/20 border border-yellow-500/30 rounded">
                  <div className="text-[10px] text-yellow-400 uppercase font-bold mb-1">Strategic Trade-off</div>
                  <div className="text-sm text-gray-200 italic">"{routeData.decision_analysis.explain_route_decision.trade_off_summary}"</div>
                </div>
              </>
            ) : (
              <div className="text-center py-6 text-gray-500">No alternative routes found.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}