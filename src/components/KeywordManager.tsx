import React, { useState } from "react";
import { Plus, X, Search } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface KeywordManagerProps {
  keywords: string[];
  onAddKeyword: (kw: string) => Promise<void>;
  onRemoveKeyword: (kw: string) => Promise<void>;
}

export function KeywordManager({ keywords, onAddKeyword, onRemoveKeyword }: KeywordManagerProps) {
  const [newKeyword, setNewKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = newKeyword.trim().toLowerCase();
    if (!term) return;

    if (keywords.includes(term)) {
      setError("Keyword is already being monitored");
      setTimeout(() => setError(null), 3000);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onAddKeyword(term);
      setNewKeyword("");
    } catch (err: any) {
      setError(err.message || "Failed to add keyword");
      setTimeout(() => setError(null), 4000);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (kw: string) => {
    try {
      await onRemoveKeyword(kw);
    } catch (err: any) {
      console.error("Failed to delete keyword:", err);
    }
  };

  return (
    <div className="bg-[#13171F] rounded-xl border border-white/10 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.15)]" id="keyword-manager">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-slate-100 tracking-tight flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-400" />
            Monitored Keywords
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Matching terms verified across global media streams
          </p>
        </div>
        <span className="text-xs bg-white/5 text-slate-300 px-2.5 py-1 rounded-full font-semibold border border-white/10 font-mono">
          {keywords.length} Active
        </span>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="relative flex gap-2 mb-4" id="keyword-form">
        <input
          type="text"
          value={newKeyword}
          onChange={(e) => setNewKeyword(e.target.value)}
          placeholder="Add emergency keyword (e.g. lockdown)"
          disabled={loading}
          id="keyword-input"
          className="flex-1 text-xs border border-white/10 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-3.5 py-2.5 bg-slate-900/50 transition-all text-slate-100 placeholder:text-slate-500"
        />
        <button
          type="submit"
          disabled={loading || !newKeyword.trim()}
          id="keyword-add-btn"
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-white/5 disabled:border-white/5 text-white p-2.5 rounded-xl transition-all flex items-center justify-center cursor-pointer disabled:cursor-not-allowed border border-blue-500"
        >
          <Plus className="h-4 w-4" />
        </button>
      </form>

      {/* Error Message */}
      {error && (
        <p className="text-xs text-red-400 font-medium mb-3 animate-fade-in" id="keyword-error">
          {error}
        </p>
      )}

      {/* Animated Keywords Grid */}
      <div className="flex flex-wrap gap-1.5 max-h-[160px] overflow-y-auto pr-1" id="keyword-chips-area">
        <AnimatePresence>
          {keywords.map((kw) => (
            <motion.div
              key={kw}
              id={`chip-${kw}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-semibold hover:border-white/20 hover:bg-white/10 transition-all cursor-default"
            >
              <span>{kw}</span>
              <button
                type="button"
                onClick={() => handleRemove(kw)}
                id={`btn-remove-${kw}`}
                className="hover:bg-white/10 text-slate-400 hover:text-slate-100 p-0.5 rounded transition-colors cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            </motion.div>
          ))}
          {keywords.length === 0 && (
            <p className="text-slate-500 text-xs py-4 text-center w-full" id="no-keywords-message">
              No active keywords. Add some above to start indexing incoming feeds.
            </p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default KeywordManager;
