import { Activity, AlertTriangle, FileText, Zap } from "lucide-react";
import { SystemStats } from "../hooks/useSocket";

interface MetricCardsProps {
  stats: SystemStats;
}

export function MetricCards({ stats }: MetricCardsProps) {
  const items = [
    {
      id: "signals-today",
      name: "Signals Monitored (Today)",
      value: stats.signalsToday,
      icon: Activity,
      color: "text-blue-400 bg-blue-500/10 border border-blue-500/20",
      description: "Aggregated matching crawl ticks"
    },
    {
      id: "alerts-today",
      name: "Spike Alerts (Today)",
      value: stats.highAlertsToday,
      icon: AlertTriangle,
      color: "text-amber-400 bg-amber-500/10 border border-amber-500/20",
      description: "Threshold breaches flagged"
    },
    {
      id: "articles-drafted",
      name: "AI Drafts Completed",
      value: stats.draftsToday,
      icon: FileText,
      color: "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20",
      description: "Ready-to-publish SEO posts"
    },
    {
      id: "lead-time-avg",
      name: "Avg Lead Time",
      value: `${stats.avgLeadTime}m early`,
      icon: Zap,
      color: "text-purple-400 bg-purple-500/10 border border-purple-500/20",
      description: "Speed advantage over Google Trends"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 px-1" id="metric-cards-container">
      {items.map((item) => {
        const IconComponent = item.icon;
        return (
          <div
            key={item.id}
            id={`card-${item.id}`}
            className="p-5 rounded-xl bg-[#13171F] border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.15)] flex items-center justify-between hover:border-white/20 transition-all duration-300"
          >
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                {item.name}
              </span>
              <div className="text-2xl font-bold text-slate-100 tracking-tight font-mono">
                {item.value}
              </div>
              <p className="text-[10px] text-slate-500">
                {item.description}
              </p>
            </div>
            
            <div className={`p-3 rounded-lg ${item.color}`}>
              <IconComponent className="h-5 w-5" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
export default MetricCards;
