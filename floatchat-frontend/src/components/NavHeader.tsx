'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavHeader() {
  const pathname = usePathname();

  return (
    // ✅ Added 'z-50' to ensure it stays on top
    <header className="fixed top-0 left-0 w-full z-50 flex items-center justify-between px-6 h-20 bg-slate-950/80 backdrop-blur-md border-b border-white/10 pointer-events-none">
      
      {/* 1. BRANDING - Fixed Overlap */}
      <div className="flex items-center gap-4 pointer-events-auto">
        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.5)] shrink-0">
          <span className="text-2xl">⚓</span>
        </div>
        
        {/* ✅ FIXED: Added 'flex-col' to stack text properly */}
        <div className="flex flex-col justify-center">
          <h1 className="text-white font-bold tracking-wider text-xl leading-none">
            FLOAT<span className="text-blue-400">CHAT</span>
          </h1>
          <p className="text-blue-300/60 text-[10px] tracking-[0.2em] uppercase mt-1 whitespace-nowrap">
            Naval Intelligence System
          </p>
        </div>
      </div>

      {/* 2. NAVIGATION */}
      <nav className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-1 p-1 bg-white/5 border border-white/10 rounded-full backdrop-blur-xl pointer-events-auto">
        <Link 
          href="/" 
          className={`px-6 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
            pathname === '/' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          🌍 LIVE OPERATIONS
        </Link>
        <Link 
          href="/war-room" 
          className={`px-6 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            pathname === '/war-room' ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]' : 'text-gray-400 hover:text-red-400 hover:bg-red-900/10'
          }`}
        >
          🚨 CRISIS WAR ROOM
        </Link>
      </nav>

      {/* 3. STATUS & ACTIONS */}
      <div className="flex gap-6 items-center pointer-events-auto">
        
        {/* ✅ FIXED: Added onClick to dispatch event */}
        <button 
          onClick={() => window.dispatchEvent(new CustomEvent('TOGGLE_PLANNER'))}
          className="hidden lg:block px-4 py-2 bg-blue-900/30 border border-blue-500/30 rounded text-blue-300 text-xs font-bold uppercase hover:bg-blue-900/50 transition-colors active:scale-95 cursor-pointer"
        >
          Enable Route Planner
        </button>

        <div className="h-8 w-px bg-white/10 hidden lg:block"></div>

        <div className="flex flex-col items-end">
          <span className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">SYSTEM STATUS</span>
          <span className="text-emerald-400 text-xs font-bold flex items-center gap-2 tracking-wider">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            ONLINE
          </span>
        </div>
      </div>
    </header>
  );
}