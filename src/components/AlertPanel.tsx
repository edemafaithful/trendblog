import { useState } from "react";
import { Alert, Draft } from "../../server/db";
import { AlertCircle, Zap, ShieldAlert, Sparkles, Check, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AlertPanelProps {
  alerts: Alert[];
  drafts: Draft[];
  onTriggerDraft: (alertId: string, keyword: string) => Promise<void>;
}

export function AlertPanel({ alerts, drafts, onTriggerDraft }: AlertPanelProps) {
  const [draftingMap, setDraftingMap] = useState<Record<string, boolean>>({});

  const handleDraftClick = async (alertId: string, keyword: string) => {
    setDraftingMap((prev) => ({ ...prev, [alertId]: true }));
    try {
      await onTriggerDraft(alertId, keyword);
    } catch (err) {
      console.error("Draft generation failed:", err);
    } finally {
      setDraftingMap((prev) => ({ ...prev, [alertId]: false }));
    }
  };

  const getPriorityConfig = (priority: Alert["priority"]) => {
    switch (priority) {
      case "HIGH":
        return {
          dot: "bg-red-500 animate-pulse",
          text: "text-red-400 bg-red-500/10 border-red-500/20",
          desc: "Critical multiple-source spike"
        };
      case "MEDIUM":
        return {
          dot: "bg-amber-500",
          text: "text-amber-400 bg-amber-500/10 border-amber-500/20",
          desc: "High single-source velocity"
        };
      case "LOW":
        return {
          dot: "bg-emerald-500",
          text: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
          desc: "Initial single matching signal"
        };
    }
  };

  // Sort alerts: HIGH first, then MEDIUM, then LOW
  const sortedAlerts = [...alerts].sort((a, b) => {
    const priorityWeight = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    return priorityWeight[b.priority] - priorityWeight[a.priority];
  });

  return (
    <div className="bg-[#13171F] rounded-xl border border-white/10 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.15)] flex flex-col h-[540px]" id="alert-panel">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-sm font-bold text-slate-100 tracking-tight flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-slate-400" />
          Priority Spike Alerts
        </h2>
        <p className="text-[11px] text-slate-400 mt-0.5 font-sans">
          Calculated alerts based on cross-source signal velocity
        </p>
      </div>

      {/* Alerts feed */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-3" id="alert-items-list">
        <AnimatePresence initial={false}>
          {sortedAlerts.map((alert) => {
            const config = getPriorityConfig(alert.priority);
            const hasDraft = drafts.some((d) => d.alertId === alert.id);
            const isGenerating = draftingMap[alert.id] || false;

            return (
              <motion.div
                key={alert.id}
                id={`alert-card-${alert.id}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="p-4 rounded-xl border border-white/5 bg-white/5 hover:border-white/10 hover:bg-white/10 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Information Column */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${config.dot}`}></span>
                    <span className="text-xs font-bold text-slate-150 capitalize">
                      "{alert.keyword}"
                    </span>
                    <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border font-mono ${config.text}`}>
                      {alert.priority}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 font-sans">
                    Confirmed across: <span className="font-semibold text-slate-300">{alert.sources.join(", ")}</span>
                  </p>

                  {/* Early warning value indicator */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 text-[10px] text-blue-400 font-semibold bg-blue-500/10 w-fit px-2.5 py-1 rounded-lg border border-blue-500/20 font-mono">
                      <Zap className="h-3.5 w-3.5" />
                      <span>Lead time: ~{alert.leadTimeMinutes}m early</span>
                    </div>

                    {alert.verdict && (
                      <span className={`text-[9px] uppercase font-bold tracking-widest px-2.5 py-1 rounded border font-mono ${
                        alert.verdict === "publish" 
                          ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" 
                          : "text-amber-400 bg-amber-500/10 border-amber-500/20"
                      }`}>
                        {alert.verdict}
                      </span>
                    )}
                  </div>

                  {/* Search Demand Capacity Bar & Score Weight Insights */}
                  <div className="mt-2.5 space-y-1.5 bg-white/5 border border-white/5 p-2.5 rounded-lg max-w-sm">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="font-semibold text-slate-300">
                        Est. search demand: <span className={`font-mono font-bold ${
                          (alert.demandScore ?? 50) >= 65 ? "text-emerald-400" : (alert.demandScore ?? 50) >= 40 ? "text-amber-400" : "text-red-400"
                        }`}>{(alert.demandScore ?? 50)}/100</span>
                      </span>
                      
                      {/* Tooltip */}
                      <div className="relative group cursor-pointer inline-block">
                        <span className="text-blue-400 hover:text-blue-300 transition-colors border-b border-blue-500/20 font-bold text-[10px] font-mono">
                          Why this story?
                        </span>
                        
                        {/* Tooltip floating box */}
                        <div className="absolute right-0 bottom-full mb-2 hidden group-hover:flex flex-col w-56 bg-[#181D26] border border-white/10 rounded-lg p-3 shadow-2xl z-50 text-[10px] text-slate-350 font-mono space-y-1.5 select-none pointer-events-none">
                          <div className="font-bold text-[10px] text-slate-100 border-b border-white/5 pb-1 mb-1.5 flex justify-between uppercase">
                            <span>Score Weight</span>
                            <span className={`${
                              (alert.demandScore ?? 50) >= 65 ? "text-emerald-400" : (alert.demandScore ?? 50) >= 40 ? "text-amber-400" : "text-red-400"
                            }`}>{alert.verdict?.toUpperCase() || (alert.priority === "HIGH" ? "PUBLISH" : "MONITOR")}</span>
                          </div>
                          
                          <div className="flex justify-between">
                            <span>Location:</span>
                            <span className="text-slate-200 font-bold">{alert.scoreBreakdown?.location ?? (alert.priority === "HIGH" ? 15 : 8)} pts</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Incident:</span>
                            <span className="text-slate-200 font-bold">{alert.scoreBreakdown?.incident ?? 18} pts</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Velocity:</span>
                            <span className="text-slate-200 font-bold">{alert.scoreBreakdown?.velocity ?? (alert.priority === "HIGH" ? 15 : 10)} pts</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Sources:</span>
                            <span className="text-slate-200 font-bold">{alert.scoreBreakdown?.sources ?? (alert.sources.length >= 2 ? 15 : 5)} pts</span>
                          </div>
                          <div className="flex justify-between border-t border-white/5 pt-1.5 mt-1 font-bold">
                            <span>Notoriety:</span>
                            <span className="text-slate-200 font-bold">{alert.scoreBreakdown?.notoriety ?? (alert.priority === "HIGH" ? 8 : 0)} pts</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Demand Speed progress bar */}
                    <div className="w-full bg-[#0B0D11] rounded-full h-1.5 overflow-hidden border border-white/5">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          (alert.demandScore ?? 50) >= 65 ? "bg-emerald-500" : (alert.demandScore ?? 50) >= 40 ? "bg-amber-500" : "bg-red-500"
                        }`}
                        style={{ width: `${alert.demandScore ?? 50}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Command Action Column */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center" id={`alert-actions-${alert.id}`}>
                  {hasDraft ? (
                    <div className="inline-flex items-center gap-1.5 text-xs text-emerald-450 font-bold bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl font-mono text-emerald-400">
                      <Check className="h-4.5 w-4.5" />
                      <span>Draft Active</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleDraftClick(alert.id, alert.keyword)}
                      disabled={isGenerating}
                      id={`btn-draft-${alert.id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 border border-blue-500 text-white px-3.5 py-2 rounded-xl transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed shadow-md"
                    >
                      {isGenerating ? (
                        <>
                          <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></div>
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Draft Article</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}

          {sortedAlerts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center" id="empty-alerts">
              <AlertCircle className="h-8 w-8 text-slate-500 mb-2" />
              <p className="text-slate-400 text-xs font-semibold">No active spike alarms triggered.</p>
              <p className="text-slate-500 text-[11px] mt-0.5">High velocity clusters will spawn alarms.</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default AlertPanel;
