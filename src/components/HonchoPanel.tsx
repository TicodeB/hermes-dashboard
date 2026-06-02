'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, Search, Send, Loader2 } from 'lucide-react';

interface MemoryEntry {
  tag: string;
  content: string;
}

export default function HonchoPanel() {
  const [tab, setTab] = useState<'browse'|'search'|'ask'>('browse');
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const API = 'https://hermes.46-225-84-249.sslip.io/api/honcho';

  useEffect(() => {
    fetch(`${API}/memory`).then(r => r.json()).then(d => setEntries(d.entries || [])).catch(() => {});
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } finally { setLoading(false); }
  };

  const handleAsk = async () => {
    if (!question.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/context?question=${encodeURIComponent(question)}`);
      const data = await res.json();
      setAnswer(data.context?.relevant || ['No relevant context found.']);
    } finally { setLoading(false); }
  };

  // Group entries by tag
  const byTag: Record<string, MemoryEntry[]> = {};
  entries.forEach(e => { if (!byTag[e.tag]) byTag[e.tag] = []; byTag[e.tag].push(e); });

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.02] rounded-lg p-0.5">
        {(['browse','search','ask'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 px-2 py-1 rounded text-[10px] font-medium transition-all ${
              tab === t ? 'bg-[#002366]/40 text-[#FFD700]' : 'text-zinc-500 hover:text-zinc-300'
            }`}>
            {t === 'browse' ? 'Memory' : t === 'search' ? 'Search' : 'Ask'}
          </button>
        ))}
      </div>

      {/* Browse */}
      {tab === 'browse' && (
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          {Object.entries(byTag).map(([tag, items]) => (
            <div key={tag}>
              <div className="text-[10px] font-semibold text-[#FFD700]/60 uppercase tracking-wider mb-1.5">{tag}</div>
              {items.map((e, i) => (
                <div key={i} className="text-[11px] text-zinc-400 py-1 border-b border-white/[0.03] last:border-0 pl-2">
                  {e.content}
                </div>
              ))}
            </div>
          ))}
          {entries.length === 0 && (
            <div className="text-center py-8 text-zinc-500 text-xs">
              <Database className="w-6 h-6 mx-auto mb-2 opacity-30" />
              Loading memory...
            </div>
          )}
        </div>
      )}

      {/* Search */}
      {tab === 'search' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search memory..."
              className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#FFD700]/30" />
            <button onClick={handleSearch} disabled={loading}
              className="p-1.5 rounded-lg bg-[#002366]/30 border border-[#FFD700]/20 text-[#FFD700] hover:bg-[#002366]/50 disabled:opacity-50">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="space-y-1.5 max-h-[350px] overflow-y-auto">
              {searchResults.map((r, i) => (
                <motion.div key={i} initial={{ opacity:0, y:5 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.03 }}
                  className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-[9px] text-[#FFD700]/60 uppercase">{r.tag}</span>
                  <p className="text-[11px] text-zinc-300 mt-0.5">{r.content}</p>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ask */}
      {tab === 'ask' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input type="text" value={question} onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAsk()}
              placeholder="Ask about missions, leads, dashboard..."
              className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#FFD700]/30" />
            <button onClick={handleAsk} disabled={loading}
              className="p-1.5 rounded-lg bg-[#002366]/30 border border-[#FFD700]/20 text-[#FFD700] hover:bg-[#002366]/50 disabled:opacity-50">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
          {answer.length > 0 && (
            <div className="space-y-2">
              {answer.map((a, i) => (
                <motion.div key={i} initial={{ opacity:0, y:5 }} animate={{ opacity:1, y:0 }}
                  className="p-2 rounded-lg bg-[#002366]/10 border border-[#FFD700]/10">
                  <p className="text-[11px] text-zinc-300">{a}</p>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
