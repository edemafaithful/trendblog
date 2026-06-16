import { useState } from "react";
import { Draft } from "../../server/db";
import { FileText, Copy, Check, ExternalLink, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface DraftPanelProps {
  drafts: Draft[];
}

export function DraftPanel({ drafts }: DraftPanelProps) {
  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null);
  const [copyFeedbackMap, setCopyFeedbackMap] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedDraftId((prev) => (prev === id ? null : id));
  };

  const handleCopy = async (draft: Draft) => {
    const fullText = `HEADLINE: ${draft.headline}\n\nMETA DESCRIPTION: ${draft.metaDescription}\n\nARTICLE BODY:\n${draft.body}`;
    try {
      await navigator.clipboard.writeText(fullText);
      setCopyFeedbackMap((prev) => ({ ...prev, [draft.id]: true }));
      // revert feedback after 2 seconds
      setTimeout(() => {
        setCopyFeedbackMap((prev) => ({ ...prev, [draft.id]: false }));
      }, 2000);
    } catch (err) {
      console.error("Failed to copy text to clipboard:", err);
    }
  };

  return (
    <div className="bg-[#13171F] rounded-xl border border-white/10 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.15)]" id="draft-panel">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-slate-100 tracking-tight flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-400" />
            Auto-Generated Article Drafts
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5 font-sans">
            Perfectly structured SEO posts built by server-side Gemini AI for spiking trends
          </p>
        </div>
        <span className="text-xs bg-white/5 text-slate-300 px-2.5 py-1 rounded-full font-semibold border border-white/10 font-mono">
          {drafts.length} Complete
        </span>
      </div>

      {/* Drafts List */}
      <div className="space-y-4" id="drafts-container-list">
        <AnimatePresence initial={false}>
          {drafts.map((draft) => {
            const isExpanded = expandedDraftId === draft.id;
            const isCopied = copyFeedbackMap[draft.id] || false;

            return (
              <motion.div
                key={draft.id}
                id={`draft-card-${draft.id}`}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="border border-white/10 rounded-xl overflow-hidden transition-all bg-white/5 hover:border-white/20"
              >
                {/* Header Row (click to expand) */}
                <div
                  onClick={() => toggleExpand(draft.id)}
                  className="p-4 bg-white/5 hover:bg-white/10 cursor-pointer flex items-center justify-between gap-4 select-none"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded font-mono">
                        Gemini Ready
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium font-mono">
                        {new Date(draft.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <h3 className="text-xs font-bold text-slate-150 truncate">
                      {draft.headline}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1 text-slate-400">
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>

                {/* Explanatory expansion section */}
                {isExpanded && (
                  <div className="p-4 border-t border-white/10 bg-[#13171F]/50 space-y-4 text-xs">
                    {/* Meta Description */}
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1 font-mono">
                        Meta Description (under 155 chars)
                      </span>
                      <p className="bg-slate-900 text-slate-300 px-3 py-2 rounded-xl text-[11px] leading-relaxed border border-white/5">
                        {draft.metaDescription}
                      </p>
                    </div>

                    {/* Article Body */}
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1.5 font-mono">
                        Article Body
                      </span>
                      <div className="space-y-3 text-slate-300 leading-relaxed max-h-[300px] overflow-y-auto pr-1">
                        {draft.body.split("\n\n").map((para, idx) => (
                          <p key={idx} className="bg-slate-900 border border-white/5 p-2.5 rounded-lg">
                            {para}
                          </p>
                        ))}
                      </div>
                    </div>

                    {/* Footer buttons / clipboard copy / WordPress deep integration */}
                    <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => handleCopy(draft)}
                        id={`btn-copy-${draft.id}`}
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-200 bg-white/5 border border-white/15 px-3 py-2 rounded-xl hover:bg-white/10 hover:text-white transition-all cursor-pointer"
                      >
                        {isCopied ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                            <span className="text-emerald-450 font-mono">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copy Full Article</span>
                          </>
                        )}
                      </button>

                      <a
                        href="https://yourdomain.com/wp-admin/post-new.php"
                        target="_blank"
                        rel="noopener Referrer"
                        id={`btn-wp-${draft.id}`}
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-500 border border-blue-500 px-3 py-2 rounded-xl transition-all cursor-pointer"
                      >
                        <span>Open WordPress</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}

          {drafts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center" id="empty-drafts">
              <AlertCircle className="h-8 w-8 text-slate-500 mb-2" />
              <p className="text-slate-400 text-xs font-semibold">No article drafts completed yet.</p>
              <p className="text-slate-505 text-[11px] mt-0.5">HIGH alerts automatically trigger drafting models.</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default DraftPanel;
