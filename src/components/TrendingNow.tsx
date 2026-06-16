import { useState, useEffect, useRef } from "react";
import { Signal, Alert, Draft } from "../../server/db";
import { motion, AnimatePresence } from "motion/react";
import { Check, Minus, Zap, Sparkles, Bell, ArrowRight, Eye, ShieldAlert } from "lucide-react";

interface TrendingNowProps {
  alerts: Alert[];
  signals: Signal[];
  drafts: Draft[];
  onTriggerDraft: (alertId: string, keyword: string) => Promise<void>;
}

interface GroupedItem {
  keyword: string;
  keywordKey: string;
  signals: Signal[];
  alert?: Alert;
  activeSources: string[];
  activeCount: number;
  demandScore: number;
  verdict: "publish" | "monitor" | "skip";
  leadTimeMinutes: number;
}

/**
 * Fallback score math matching the exact backend server scoring logic
 */
function getKeywordDemandScore(keyword: string, keywordSignals: Signal[], alert?: Alert) {
  if (alert && alert.demandScore !== undefined) {
    return alert.demandScore;
  }

  const title = keywordSignals[0]?.title || keyword;
  const hasMatch = (text: string, kw: string) => new RegExp(`\\b${kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i").test(text);

  // 1. Location
  let location = 3;
  const tier1 = ["New York", "Los Angeles", "Chicago", "Houston", "Miami", "Dallas", "Atlanta", "Washington DC", "Philadelphia", "Phoenix"];
  if (tier1.some(city => hasMatch(title, city))) {
    location = 25;
  } else {
    const states = [
      "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", 
      "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", 
      "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", 
      "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", 
      "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", 
      "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", 
      "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"
    ];
    if (states.some(st => hasMatch(title, st))) {
      location = 15;
    }
  }

  // 2. Incident
  let incident = 0;
  const incidents = [
    { kws: ["shooting", "mass shooting", "school shooting"], pts: 25 },
    { kws: ["school lockdown", "lockdown"], pts: 22 },
    { kws: ["explosion", "bomb"], pts: 20 },
    { kws: ["death", "killed", "murder"], pts: 18 },
    { kws: ["fire", "building fire"], pts: 15 }
  ];
  for (const item of incidents) {
    if (item.kws.some(kw => hasMatch(title, kw))) {
      incident = Math.max(incident, item.pts);
    }
  }

  // 3. Velocity
  const maxVelocity = Math.max(...keywordSignals.map(s => s.velocity), 0);
  let velocity = 2;
  if (maxVelocity > 200) velocity = 20;
  else if (maxVelocity > 100) velocity = 15;
  else if (maxVelocity > 50) velocity = 10;
  else if (maxVelocity > 20) velocity = 5;

  // 4. Sources
  const uniqueSources = new Set(keywordSignals.map(s => s.source)).size;
  let sources = 5;
  if (uniqueSources >= 4) sources = 20;
  else if (uniqueSources === 3) sources = 15;
  else if (uniqueSources === 2) sources = 10;

  // 5. Notoriety
  let notoriety = 0;
  if (/\b(school|university|college)\b/i.test(title)) notoriety = 8;
  else if (/\b(hospital|mall|church|airport)\b/i.test(title)) notoriety = 7;
  else if (/\b(police|fbi|government)\b/i.test(title)) notoriety = 6;

  return location + incident + velocity + sources + notoriety;
}

export function TrendingNow({ alerts, signals, drafts, onTriggerDraft }: TrendingNowProps) {
  const [watchingKeywords, setWatchingKeywords] = useState<string[]>([]);
  const [pulsingKeywords, setPulsingKeywords] = useState<string[]>([]);
  const [draftingMap, setDraftingMap] = useState<Record<string, boolean>>({});
  const prevSourcesRef = useRef<Record<string, string[]>>({});

  // 1. Group signals and alerts by keyword
  const uniqueKeywords = Array.from(
    new Set([
      ...signals.map((s) => s.keyword.toLowerCase()),
      ...alerts.map((a) => a.keyword.toLowerCase())
    ])
  );

  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;

  const displayedItems: GroupedItem[] = uniqueKeywords
    .map((kw) => {
      const kSignals = signals.filter((s) => s.keyword.toLowerCase() === kw);
      const kAlert = alerts.find((a) => a.keyword.toLowerCase() === kw);

      // Confirm which sources reported this keyword in last 10 minutes
      const activeSources = ["twitter", "reddit", "rss", "trends"].filter((src) =>
        kSignals.some((s) => s.source === src && new Date(s.timestamp).getTime() > tenMinutesAgo)
      );

      const activeCount = activeSources.length;
      const demandScore = kAlert?.demandScore ?? getKeywordDemandScore(kw, kSignals, kAlert);
      const verdict: "publish" | "monitor" | "skip" = demandScore >= 65 ? "publish" : demandScore >= 40 ? "monitor" : "skip";
      const leadTimeMinutes = kAlert?.leadTimeMinutes ?? 18;

      return {
        keyword: kAlert?.keyword || kSignals[0]?.keyword || kw,
        keywordKey: kw,
        signals: kSignals,
        alert: kAlert,
        activeSources,
        activeCount,
        demandScore,
        verdict,
        leadTimeMinutes
      };
    })
    .filter((item) => {
      const isWatched = watchingKeywords.includes(item.keywordKey);
      // Group signals and alerts by keyword. For each keyword that has signals from 2 or more sources (or is watched), render.
      const hasMinSources = item.activeCount >= 2 || (item.signals.length > 0 && isWatched);
      // Only show keywords with demand score above 40
      return hasMinSources && item.demandScore > 40;
    })
    // Sort cards by demand score descending (highest first)
    .sort((a, b) => b.demandScore - a.demandScore);

  // 2. Track real-time transitions & Fire Notifications
  useEffect(() => {
    const nextPrevSources: Record<string, string[]> = {};

    displayedItems.forEach((item) => {
      const kwKey = item.keywordKey;
      const prevSources = prevSourcesRef.current[kwKey];
      const currSources = item.activeSources;

      if (prevSources !== undefined) {
        // When a new source confirms a keyword already showing as EARLY SIGNAL
        if (prevSources.length === 1 && currSources.length === 2) {
          // Subtle pulse animation on the card for 3 seconds to catch eye
          setPulsingKeywords((prev) => [...prev, kwKey]);
          setTimeout(() => {
            setPulsingKeywords((prev) => prev.filter((k) => k !== kwKey));
          }, 3000);
        }

        // When a third source confirms:
        if (prevSources.length <= 2 && currSources.length === 3) {
          // Browser Notification
          if ("Notification" in window && Notification.permission === "granted") {
            try {
              new Notification(`🔴 CONFIRMED: ${item.keyword} trending on 3 sources — publish now`);
            } catch (err) {
              console.warn("Could not fire desktop notification.", err);
            }
          }
        }
      }

      nextPrevSources[kwKey] = currSources;
    });

    prevSourcesRef.current = nextPrevSources;
  }, [displayedItems]);

  // Summary counts
  const greenCount = displayedItems.filter((i) => i.activeCount >= 3).length;
  const amberCount = displayedItems.filter((i) => i.activeCount === 2).length;
  const grayCount = displayedItems.filter((i) => i.activeCount <= 1).length;

  let summaryLine = "All quiet. No spikes detected in the last 30 minutes.";
  let summaryColor = "text-slate-400";
  if (greenCount >= 1) {
    summaryLine = `🔴 ${greenCount} confirmed spike${greenCount > 1 ? "s" : ""} right now — act immediately`;
    summaryColor = "text-red-400";
  } else if (amberCount >= 1) {
    summaryLine = `🟡 ${amberCount} developing spike${amberCount > 1 ? "s" : ""} — monitor and prepare drafts`;
    summaryColor = "text-amber-400";
  } else if (grayCount >= 1) {
    summaryLine = `⚪ ${grayCount} early signal${grayCount > 1 ? "s" : ""} — nothing confirmed yet`;
    summaryColor = "text-slate-300";
  }

  const handleAction = async (item: GroupedItem) => {
    const isWatched = watchingKeywords.includes(item.keywordKey);
    const hasDraft = drafts.some((d) => d.keyword.toLowerCase() === item.keywordKey);

    if (hasDraft) {
      // Focus/Scroll into drafts immediately
      document.getElementById("draft-panel")?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    if (item.activeCount >= 2) {
      // CONFIRMED (3+) or LIKELY (2) SPIKE
      setDraftingMap((p) => ({ ...p, [item.keywordKey]: true }));
      try {
        await onTriggerDraft(item.alert?.id || "manual", item.keyword);
        if (item.activeCount >= 3) {
          // Green: calls generateArticle then opens Draft Panel
          setTimeout(() => {
            document.getElementById("draft-panel")?.scrollIntoView({ behavior: "smooth" });
          }, 300);
        }
      } catch (err) {
        console.error("Draft generation failed:", err);
      } finally {
        setDraftingMap((p) => ({ ...p, [item.keywordKey]: false }));
      }
    } else {
      // EARLY SIGNAL (1 source)
      if (!isWatched) {
        setWatchingKeywords((prev) => [...prev, item.keywordKey]);
      }
    }
  };

  const getSourceIconAndPill = (item: GroupedItem, src: "twitter" | "reddit" | "rss" | "trends") => {
    const isConfirmed = item.activeSources.includes(src);
    const sourceConfig = {
      twitter: { label: "Twitter", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
      reddit: { label: "Reddit", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
      rss: { label: "RSS", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
      trends: { label: "Google Trends", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" }
    };

    if (isConfirmed) {
      return (
        <span
          key={src}
          className={`inline-flex items-center gap-1 text-[10px] font-bold py-1 px-2.5 rounded-lg border font-mono transition-colors duration-300 ${sourceConfig[src].color}`}
        >
          <Check className="h-3 w-3 inline" />
          <span>{sourceConfig[src].label}</span>
        </span>
      );
    } else {
      return (
        <span
          key={src}
          className="inline-flex items-center gap-1 text-[10px] font-medium py-1 px-2.5 rounded-lg border border-white/5 bg-transparent text-slate-500 font-mono transition-colors duration-300"
        >
          <Minus className="h-3 w-3 inline text-slate-650" />
          <span>{sourceConfig[src].label}</span>
        </span>
      );
    }
  };

  return (
    <div className="bg-[#13171F] rounded-xl border border-white/10 p-6 shadow-[0_4px_20px_rgba(0,0,0,0.15)] flex flex-col md:col-span-2 min-h-[540px]" id="trending-now-section">
      {/* Header & Direct Summary Line */}
      <div className="mb-6 border-b border-white/5 pb-4">
        <h2 className="text-base font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-blue-400" />
          Trending Radar Live
        </h2>
        
        {/* Dynamic English Summary Banner */}
        <p className={`text-xs mt-2 font-bold font-mono py-1 rounded-lg ${summaryColor}`}>
          SYSTEM STATE: {summaryLine}
        </p>
      </div>

      {/* Grid of Grouped Spikes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto max-h-[700px] pr-1" id="trending-now-cards-grid">
        <AnimatePresence initial={false}>
          {displayedItems.map((item) => {
            const hasTrends = item.activeSources.includes("trends");
            const hasDraft = drafts.some((d) => d.keyword.toLowerCase() === item.keywordKey);
            const isPulsing = pulsingKeywords.includes(item.keywordKey);
            const isGenerating = draftingMap[item.keywordKey] || false;
            
            // Red flash border if trends is confirmed and draft does not exist yet
            const isRedForceFlash = hasTrends && !hasDraft;

            const cardBorderClasses = isRedForceFlash
              ? "border-red-500/80 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse"
              : isPulsing
              ? "border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.3)] animate-pulse"
              : "border-white/5 hover:border-white/15 bg-[#181D26]/50";

            // Determine banner config
            let bannerBg = "bg-slate-700";
            let bannerTitle = "EARLY SIGNAL";
            let bannerSubtext = "One source only. Wait for confirmation.";
            let btnText = "Watch This Story";
            let btnColor = "bg-slate-700 hover:bg-slate-650 text-slate-100 border-slate-600";

            if (item.activeCount >= 3) {
              bannerBg = "bg-gradient-to-r from-emerald-600 to-teal-500";
              bannerTitle = "CONFIRMED SPIKE";
              bannerSubtext = "This is trending. Publish now.";
              btnText = "Draft & Publish Now";
              btnColor = "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500";
            } else if (item.activeCount === 2) {
              bannerBg = "bg-gradient-to-r from-amber-500 to-orange-500";
              bannerTitle = "LIKELY SPIKE";
              bannerSubtext = "Strong signal. Draft article while monitoring.";
              btnText = "Draft Article";
              btnColor = "bg-amber-500 hover:bg-amber-450 text-white border-amber-450";
            }

            if (hasDraft) {
              btnText = "View Draft Ready";
              btnColor = "bg-blue-600 hover:bg-blue-550 text-white border-blue-500";
            }

            // Get the specific quote-lines
            const sourceTitles = ["twitter", "reddit", "rss", "trends"]
              .map((src) => {
                const sourceSignals = item.signals.filter((s) => s.source === src);
                if (sourceSignals.length === 0) return null;
                const sorted = [...sourceSignals].sort(
                  (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                );
                return { src, title: sorted[0].title };
              })
              .filter(Boolean) as { src: "twitter" | "reddit" | "rss" | "trends"; title: string }[];

            return (
              <motion.div
                key={item.keywordKey}
                id={`trending-card-${item.keywordKey}`}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className={`rounded-2xl overflow-hidden border flex flex-col justify-between transition-all duration-300 ${cardBorderClasses}`}
              >
                <div>
                  {/* CONFIDENCE BANNER (full width, top of card) */}
                  <div className={`p-4 ${bannerBg} text-white`}>
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-wider">{bannerTitle}</h3>
                        <p className="text-[10px] text-white/90 font-sans mt-0.5">{bannerSubtext}</p>
                      </div>

                      {/* LEAD TIME BADGE (top right corner of card) */}
                      <div className="shrink-0 text-right">
                        {hasTrends ? (
                          <span className="text-[9px] uppercase font-bold tracking-widest px-2.5 py-1 rounded bg-black/35 text-red-300 border border-red-500/30 animate-pulse inline-block">
                            Google Trends confirmed — publish immediately
                          </span>
                        ) : (
                          <span className={`text-[9px] font-bold tracking-wide px-2.5 py-1 rounded border inline-block ${
                            item.leadTimeMinutes >= 15
                              ? "bg-black/20 text-emerald-300 border-emerald-400/20"
                              : item.leadTimeMinutes >= 10
                              ? "bg-black/20 text-amber-300 border-amber-400/20"
                              : "bg-black/20 text-red-300 border-red-400/20"
                          }`}>
                            ~{item.leadTimeMinutes} min before Google Trends peaks
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 space-y-4">
                    {/* KEYWORD (large, bold, below banner) */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-400 font-bold uppercase tracking-widest font-mono">STORY TARGET:</span>
                        {watchingKeywords.includes(item.keywordKey) && (
                          <span className="text-[9px] font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded">
                            Watching
                          </span>
                        )}
                      </div>
                      <h2 className="text-lg font-black text-slate-100 tracking-tight mt-0.5 capitalize">
                        "{item.keyword}"
                      </h2>
                    </div>

                    {/* SOURCE CONFIRMATION ROW */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Coverage Confirmation:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {["twitter", "reddit", "rss", "trends"].map((src) =>
                          getSourceIconAndPill(item, src as any)
                        )}
                      </div>
                    </div>

                    {/* WHAT PEOPLE ARE SEARCHING */}
                    {sourceTitles.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-white/5">
                        <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Live Ingested Search Queries:</p>
                        <div className="space-y-1.5 text-xs bg-[#0F1218] p-2.5 rounded-lg border border-white/5">
                          {sourceTitles.map(({ src, title }) => (
                            <div key={src} className="flex items-start gap-1.5">
                              <span className="font-bold text-slate-450 font-mono text-[9px] uppercase min-w-[55px] pt-0.5 text-slate-400 select-none">
                                {src === "trends" ? "Google" : src}:
                              </span>
                              <span className="text-slate-200 italic leading-snug">"{title}"</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* VELOCITY INDICATOR */}
                    <div className="pt-2 border-t border-white/5 space-y-1.5">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="uppercase font-bold tracking-widest text-slate-400">Search Demand Building</span>
                        
                        {/* Interactive Score Explainer Tooltip */}
                        <div className="relative group cursor-pointer inline-block">
                          <span className="text-blue-400 hover:text-blue-300 transition-colors border-b border-blue-500/20 font-bold font-mono">
                            Breakdown
                          </span>
                          <div className="absolute right-0 bottom-full mb-2 hidden group-hover:flex flex-col w-48 bg-[#181D26] border border-white/10 rounded-lg p-2.5 shadow-2xl z-50 text-[10px] text-slate-300 font-mono space-y-1 select-none pointer-events-none">
                            <div className="font-bold text-slate-100 border-b border-white/5 pb-1 mb-1 flex justify-between uppercase">
                              <span>Metric Points</span>
                              <span>{item.demandScore} pts</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Location:</span>
                              <span>{item.alert?.scoreBreakdown?.location ?? (item.alert?.priority === "HIGH" ? 15 : 8)} pts</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Incident:</span>
                              <span>{item.alert?.scoreBreakdown?.incident ?? 18} pts</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Velocity:</span>
                              <span>{item.alert?.scoreBreakdown?.velocity ?? (item.alert?.priority === "HIGH" ? 15 : 10)} pts</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Sources:</span>
                              <span>{item.alert?.scoreBreakdown?.sources ?? (item.activeCount >= 2 ? 15 : 5)} pts</span>
                            </div>
                            <div className="flex justify-between border-t border-white/5 pt-1 mt-1 font-bold">
                              <span>Notoriety:</span>
                              <span>{item.alert?.scoreBreakdown?.notoriety ?? 0} pts</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="w-full bg-[#0B0D11] rounded-full h-1.5 overflow-hidden border border-white/5">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            item.demandScore >= 65 ? "bg-emerald-500" : item.demandScore >= 40 ? "bg-amber-500" : "bg-red-500"
                          }`}
                          style={{ width: `${item.demandScore}%` }}
                        ></div>
                      </div>
                      <p className="text-[10px] text-slate-400 font-sans">
                        Demand score: <span className="font-bold font-mono text-slate-200">{item.demandScore}/100</span> —{" "}
                        <span className={`font-bold ${
                          item.demandScore >= 65 ? "text-emerald-400" : item.demandScore >= 40 ? "text-amber-400" : "text-red-400"
                        }`}>
                          {item.demandScore >= 65 ? "High" : item.demandScore >= 40 ? "Medium" : "Low"}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* ACTION BUTTON (bottom of card, full width) */}
                <div className="p-4 pt-0">
                  <button
                    type="button"
                    onClick={() => handleAction(item)}
                    disabled={isGenerating}
                    className={`w-full py-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md select-none disabled:opacity-50 ${btnColor}`}
                  >
                    {isGenerating ? (
                      <>
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></div>
                        <span>Drafting Article...</span>
                      </>
                    ) : hasDraft ? (
                      <>
                        <Eye className="h-3.5 w-3.5 text-white" />
                        <span>View Active Draft</span>
                      </>
                    ) : item.activeCount <= 1 && watchingKeywords.includes(item.keywordKey) ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-blue-400" />
                        <span>Watching for confirmations</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>{btnText}</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            );
          })}

          {displayedItems.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-24 text-center bg-[#151922]/50 rounded-2xl border border-white/5" id="trending-empty">
              <ShieldAlert className="h-10 w-10 text-slate-500 mb-2 animate-pulse" />
              <p className="text-slate-400 text-sm font-bold">No trending spikes mapped currently.</p>
              <p className="text-slate-505 text-[11px] mt-1 font-sans">
                Multisource confirmed spikes with demand over 40 list automatically.
              </p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default TrendingNow;
