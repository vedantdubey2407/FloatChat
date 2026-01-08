'use client';

import dynamic from 'next/dynamic';

// Globe with NO SSR
const GlobeViz = dynamic(() => import('../components/GlobeViz'), { ssr: false });

export default function Home() {
  return (
    <main className="h-screen w-screen bg-black relative overflow-hidden">
      
      {/* HEADER OVERLAY */}
      <div className="absolute top-5 left-5 z-10 pointer-events-none">
        <h1 className="text-white font-bold text-4xl tracking-tighter">
          FLOAT<span className="text-blue-500">CHAT</span>
        </h1>
        <p className="text-gray-400 text-sm">Real-time Argo Float Tracking</p>
      </div>

      {/* MAIN APP (Globe + Chat + Dashboard are all inside here now) */}
      <GlobeViz />
      
    </main>
  );
}