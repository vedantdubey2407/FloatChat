'use client';

import { useState } from 'react';
import jsPDF from 'jspdf'; 

// ✅ FIX 1: Teach TypeScript about SpeechRecognition
declare global {
  interface Window {
    webkitSpeechRecognition: any;
  }
}

// ✅ FIX 2: Define the props that GlobeViz is trying to pass
interface ChatConsoleProps {
  onCommand: (cmd: any) => void;
  plannerMode: boolean;
  onTogglePlanner: () => void;
}

type ChatMessage = {
  role: 'user' | 'ai';
  text: string;
};

export default function ChatConsole({ onCommand, plannerMode, onTogglePlanner }: ChatConsoleProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  /* --- PDF GENERATOR --- */
  const generatePDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(0, 0, 50);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('FLOATCHAT MISSION REPORT', 20, 25);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 35);

    // Content
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    let y = 60;

    chatHistory.forEach((msg) => {
      if (y > 270) { doc.addPage(); y = 20; }
      
      const prefix = msg.role === 'user' ? 'YOU: ' : 'AI: ';
      doc.setFont('helvetica', msg.role === 'user' ? 'bold' : 'normal');
      
      const lines = doc.splitTextToSize(`${prefix}${msg.text}`, 170);
      doc.text(lines, 20, y);
      y += lines.length * 7 + 5;
    });

    doc.save('mission_report.pdf');
    return '📄 Mission Report downloaded.';
  };

  /* --- VOICE INPUT --- */
  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Browser does not support voice input.');
      return;
    }

    const SpeechRecognition = window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      sendMessage(transcript);
    };

    recognition.start();
  };

  /* --- SEND MESSAGE --- */
  const sendMessage = async (msgText = input) => {
    if (!msgText.trim()) return;

    // 1. Update Local History
    const newHistory = [...chatHistory, { role: 'user', text: msgText } as ChatMessage];
    setChatHistory(newHistory);
    setLoading(true);
    setInput('');

    // 2. Check for Client-Side Commands (PDF)
    if (msgText.toLowerCase().includes('generate report')) {
      const reply = generatePDF();
      setChatHistory([...newHistory, { role: 'ai', text: reply }]);
      setLoading(false);
      return;
    }

    // 3. API Call
    try {
      const res = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msgText }),
      });

      const data = await res.json();
      
      setChatHistory(prev => [...prev, { role: 'ai', text: data.reply }]);

      if (data.command && onCommand) {
        onCommand(data.command);
      }
    } catch (error) {
      setChatHistory(prev => [...prev, { role: 'ai', text: '❌ System Offline.' }]);
    }
    setLoading(false);
  };

  /* --- UI --- */
  return (
    <div className="absolute top-5 right-5 z-40 w-80 flex flex-col items-end gap-2">
      
      {/* Route Mode Toggle Button */}
      <button 
        onClick={onTogglePlanner}
        className={`px-4 py-2 rounded-full font-bold shadow-lg transition-all text-sm ${
          plannerMode ? 'bg-yellow-500 text-black scale-105' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
        }`}
      >
        {plannerMode ? '📍 ROUTE MODE: ACTIVE' : '⚓ Enable Route Planner'}
      </button>

      {/* Chat Window */}
      <div className="bg-gray-900/90 backdrop-blur-md p-3 rounded-xl border border-white/10 w-full shadow-xl">
        <div className="h-60 overflow-y-auto mb-2 p-2 bg-black/20 rounded text-xs flex flex-col gap-2 custom-scrollbar">
          {chatHistory.length === 0 && (
            <div className="text-gray-500 text-center mt-10">System Online.<br/>Awaiting orders.</div>
          )}
          {chatHistory.map((msg, i) => (
            <div key={i} className={`p-2 rounded max-w-[90%] ${msg.role === 'user' ? 'bg-blue-900/50 self-end text-blue-100' : 'bg-gray-800/50 self-start text-gray-300'}`}>
              <strong>{msg.role === 'user' ? 'YOU' : 'AI'}:</strong> {msg.text}
            </div>
          ))}
          {loading && <span className="text-yellow-300 text-[10px] animate-pulse">Processing...</span>}
        </div>

        <div className="flex gap-2">
          <button onClick={startListening} className={`px-2 rounded ${isListening ? 'bg-red-600 animate-pulse' : 'bg-gray-700 hover:bg-gray-600'}`}>
            🎤
          </button>
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Command ('Generate Report')..." 
            className="w-full bg-black/50 text-white text-xs px-2 py-2 rounded border border-gray-700 focus:border-blue-500 outline-none"
          />
          <button onClick={() => sendMessage()} disabled={loading} className="bg-blue-600 px-3 py-1 rounded text-xs font-bold hover:bg-blue-500 disabled:opacity-50">
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}