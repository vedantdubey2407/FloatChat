'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import { 
  Globe, 
  Activity, 
  Anchor, 
  Fish, 
  ShieldAlert, 
  ChevronRight, 
  Lock, 
  Mail, 
  X, 
  Zap, 
  Radar 
} from 'lucide-react';

// --- IMPORTS ---
// Import your existing main app (The Globe)
const GlobeViz = dynamic(() => import('../components/GlobeViz'), { 
  ssr: false,
  loading: () => (
    <div className="h-screen w-screen bg-black flex items-center justify-center text-white">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
        <p className="font-mono text-cyan-500 text-sm">INITIALIZING SYSTEM...</p>
      </div>
    </div>
  )
});

// --- SUB-COMPONENTS ---

const LiveTicker = () => {
  return (
    <div className="w-full bg-slate-900/50 border-y border-slate-800 overflow-hidden py-2 relative z-20 backdrop-blur-sm">
      <motion.div 
        className="flex whitespace-nowrap gap-12 text-xs font-mono text-cyan-500/80"
        animate={{ x: [0, -1000] }}
        transition={{ repeat: Infinity, duration: 35, ease: "linear" }}
      >
        {[...Array(2)].map((_, i) => (
          <div key={i} className="flex gap-12">
            <span className="flex items-center gap-2">● SYSTEM ONLINE</span>
            <span className="flex items-center gap-2">► GLOBAL RISK SCORE: 124 (LOW)</span>
            <span className="flex items-center gap-2">► ACTIVE STORMS: 3 TRACKED</span>
            <span className="flex items-center gap-2">► PIRACY ZONES: GULF OF ADEN [ELEVATED]</span>
            <span className="flex items-center gap-2">► SPECIES RECORDS: 45,201 VERIFIED</span>
            <span className="flex items-center gap-2">► LIVE SENSORS: 89% COVERAGE</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
};

const AuthModal = ({ isOpen, onClose, onLogin }: { isOpen: boolean; onClose: () => void; onLogin: () => void }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Fake delay to simulate backend verification
    setTimeout(() => {
      setLoading(false);
      onLogin(); // Trigger the transition to the main app
    }, 1500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-md bg-slate-900/90 border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl"
          >
            <div className="p-6 pb-0 flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Globe className="w-5 h-5 text-cyan-400" />
                  Marine Knowledge Engine
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  {isLogin ? 'Initialize session credentials.' : 'Request new clearance access.'}
                </p>
              </div>
              <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <form className="space-y-4" onSubmit={handleAuth}>
                {!isLogin && (
                  <div className="space-y-1">
                    <label className="text-xs font-mono text-slate-400">OPERATOR ID</label>
                    <div className="relative">
                      <Zap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input type="text" placeholder="Callsign" className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 pl-10 pr-4 text-sm text-white focus:ring-1 focus:ring-cyan-500 outline-none" required />
                    </div>
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-400">EMAIL ENCRYPTION</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input type="email" placeholder="user@fleet-command.com" className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 pl-10 pr-4 text-sm text-white focus:ring-1 focus:ring-cyan-500 outline-none" required />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-400">ACCESS KEY</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input type="password" placeholder="••••••••" className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 pl-10 pr-4 text-sm text-white focus:ring-1 focus:ring-cyan-500 outline-none" required />
                  </div>
                </div>

                <button 
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium py-2.5 rounded-lg transition-all shadow-lg shadow-cyan-900/20 active:scale-[0.98] mt-2 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    isLogin ? 'Authenticate' : 'Register Operator'
                  )}
                </button>
              </form>

              <div className="mt-6 flex items-center justify-between text-xs text-slate-500 border-t border-slate-800 pt-4">
                <span>{isLogin ? "No clearance?" : "Already authorized?"}</span>
                <button onClick={() => setIsLogin(!isLogin)} className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">
                  {isLogin ? "Request Access →" : "Log In →"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const FeatureCard = ({ icon: Icon, title, description, color }: any) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className={`p-6 rounded-2xl bg-slate-900/40 border border-slate-800/50 backdrop-blur-sm group hover:border-${color}-500/30 transition-all`}
  >
    <div className={`w-12 h-12 rounded-lg bg-${color}-500/10 flex items-center justify-center mb-4 group-hover:bg-${color}-500/20 transition-colors`}>
      <Icon className={`w-6 h-6 text-${color}-400`} />
    </div>
    <h3 className="text-lg font-bold text-white mb-2 font-mono flex items-center gap-2">
      {title}
      <ChevronRight className={`w-4 h-4 opacity-0 group-hover:opacity-100 text-${color}-400 transition-all`} />
    </h3>
    <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
  </motion.div>
);

// --- MAIN PAGE COMPONENT ---

export default function Home() {
  const [authOpen, setAuthOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // If user is authenticated, render the Main App (GlobeViz)
  if (isAuthenticated) {
    return <GlobeViz />;
  }

  // Otherwise, render the Landing Page
  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-cyan-500/30 overflow-x-hidden font-sans">
      
      {/* Background Gradients */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950 pointer-events-none" />
      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-40 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <div className="w-8 h-8 bg-cyan-500/10 rounded-lg flex items-center justify-center border border-cyan-500/20">
              <Globe className="w-5 h-5 text-cyan-400" />
            </div>
            <span>MKE <span className="text-slate-600">v5.0</span></span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden md:block text-xs font-mono text-emerald-500 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              SYSTEM OPERATIONAL
            </span>
            <button 
              onClick={() => setAuthOpen(true)}
              className="bg-slate-800 hover:bg-slate-700 text-white text-sm px-4 py-2 rounded-lg border border-slate-700 transition-all"
            >
              Log In
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-6">
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/30 border border-cyan-800/30 text-cyan-400 text-xs font-mono mb-6">
              <Radar className="w-3 h-3 animate-spin-slow" />
              PLANETARY DIGITAL TWIN DETECTED
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
              The Ocean's <br /> Intelligence Network
            </h1>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              A unified command platform for Naval Security and Marine Preservation. 
              Monitor real-time threats, route fleets safely, and predict ecological futures 
              with our advanced A* and Bio-Sim engines.
            </p>
            <div className="flex flex-col md:flex-row items-center justify-center gap-4">
              <button 
                onClick={() => setAuthOpen(true)}
                className="group relative px-8 py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-medium transition-all shadow-[0_0_20px_rgba(8,145,178,0.3)] hover:shadow-[0_0_40px_rgba(8,145,178,0.5)] w-full md:w-auto"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  Initialize System
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
              <button className="px-8 py-4 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl font-medium border border-slate-800 transition-all w-full md:w-auto">
                View Documentation
              </button>
            </div>
          </motion.div>
        </div>
        
        {/* Decorative Lines */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-white/5 rounded-full pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-white/5 rounded-full pointer-events-none" />
      </section>

      <LiveTicker />

      {/* Feature Grid */}
      <section className="py-24 bg-slate-950 relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard 
              icon={Anchor}
              title="The War Room"
              description="Tactical command interface. Execute A* pathfinding algorithms to calculate safe routes, avoid active storm cells, and monitor fleet logistics in real-time."
              color="emerald"
            />
            <FeatureCard 
              icon={ShieldAlert}
              title="Situation Room"
              description="Strategic threat monitoring powered by NEXUS AI. Track piracy zones, political unrest, and generate automated SITREPs with a live Global Risk Score."
              color="amber"
            />
            <FeatureCard 
              icon={Fish}
              title="Bio-Engine"
              description="Predictive ecological modeling. Simulate ocean conditions in 2030, 2050, & 2100 to analyze species survival rates against acidification and warming."
              color="cyan"
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-12 bg-slate-950 text-slate-500 text-sm">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" />
            <span>Operational Status: Nominal</span>
          </div>
          <p>© 2026 Marine Knowledge Engine. Restricted Access.</p>
        </div>
      </footer>

      {/* Authentication Modal */}
      <AuthModal 
        isOpen={authOpen} 
        onClose={() => setAuthOpen(false)} 
        onLogin={() => setIsAuthenticated(true)} // ✅ TRIGGERS THE APP LOAD
      />
    </div>
  );
}