import { useState } from "react";
import { Signal } from "../../server/db";
import { Rss, Compass, Send, TrendingUp, Filter, AlertCircle, Clock } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SignalFeedProps {
  signals: Signal[];
}

export function SignalFeed({ signals }: SignalFeedProps) {
  const [activeFilter, setActiveFilter] = useState<"all" | "rss" | "reddit" | "twitter" | "trends">("all");

  const filteredSignals = signals.filter((s) => {
    if (activeFilter === "all") return true;
    return s.source === activeFilter;
  });

  // Simple relative helper format
  const formatTimeAgo = (isoString: string) => {
    const elapsed = Date.now() - new Date(isoString).getTime();
    const seconds = Math.floor(elapsed / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const getSourceConfig = (source: Signal["source"]) => {
    switch (source) {
      case "rss":
        return {
          icon: Rss,
          bg: "bg-blue-500/10 text-blue-400 border-blue-500/20",
          label: "RSS News Feed"
        };
      case "reddit":
        return {
          icon: Compass,
          bg: "bg-orange-500/10 text-orange-400 border-orange-500/20",
          label: "Reddit Community"
        };
      case "trends":
        return {
          icon: TrendingUp,
          bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          label: "Google Trends"
        };
      case "twitter":
        return {
          icon: Send,
          bg: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
          label: "X / Twitter"
        };
    }
  };

  return (
    <div className="bg-[#13171F] rounded-xl border border-white/10 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.15)] flex flex-col h-[540px]" id="signal-feed">
      {/* Feed Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-bold text-slate-100 tracking-tight flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            Live Signal Feed
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5 font-sans">
            Real-time incoming match streams from crawl loops
          </p>
        </div>

        {/* Source filtering tabs */}
        <div className="flex flex-wrap gap-1" id="filter-tabs">
          {(["all", "rss", "reddit", "twitter", "trends"] as const).map((source) => (
            <button
              key={source}
              onClick={() => setActiveFilter(source)}
              id={`filter-${source}`}
              className={`text-[10px] uppercase font-bold px-2.5 py-1.5 rounded-lg border cursor-pointer transition-all ${
                activeFilter === source
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10"
              }`}
            >
              {source}
            </button>
          ))}
        </div>
      </div>

      {/* Stream Area */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-2.5" id="signal-scroll-area">
        <AnimatePresence initial={false}>
          {filteredSignals.map((signal) => {
            const config = getSourceConfig(signal.source);
            const Icon = config.icon;
            
            // Normalize velocity bar percent (mock ranges 1-150)
            const velocityPercent = Math.min((signal.velocity / 120) * 100, 100);

            return (
              <motion.div
                key={signal.id}
                id={`signal-card-${signal.id}`}
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className="p-3.5 rounded-xl border border-white/5 hover:border-white/10 bg-white/5 hover:bg-white/10 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
              >
                {/* Meta details row */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`p-1 rounded border ${config.bg}`}>
                      <Icon className="h-3 w-3" />
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">
                      {signal.sourceName}
                    </span>
                  </div>

                  <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md capitalize font-mono">
                    {signal.keyword}
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-xs font-semibold text-slate-200 leading-snug mb-1">
                  {signal.title}
                </h3>

                {/* Description */}
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-3">
                  {signal.description}
                </p>

                {/* Velocity and recency meter */}
                <div className="flex items-center justify-between gap-4 border-t border-white/5 pt-2.5">
                  {/* Thermometer speed bar */}
                  <div className="flex-1 max-w-[200px]">
                    <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400 font-medium mb-1">
                      <span>Signal Velocity</span>
                      <span className="font-bold text-slate-300 font-mono">
                        {Math.round(signal.velocity)} unit/m
                      </span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${velocityPercent}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                    <Clock className="h-3 w-3" />
                    <span>{formatTimeAgo(signal.timestamp)}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {filteredSignals.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center" id="empty-feed">
              <AlertCircle className="h-8 w-8 text-slate-500 mb-2" />
              <p className="text-slate-400 text-xs">No signals found matching criteria.</p>
              <p className="text-slate-500 text-[11px] mt-0.5">Scanners are monitoring active loops dynamically.</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default SignalFeed;
