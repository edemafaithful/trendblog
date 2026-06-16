import fs from "fs";
import path from "path";

const DB_FILE = path.join(process.cwd(), "db.json");

export interface Signal {
  id: string;
  keyword: string;
  source: "rss" | "reddit" | "trends" | "twitter";
  sourceName: string;
  title: string;
  description: string;
  url: string;
  velocity: number; // e.g., matching feeds or upvote count per min
  timestamp: string;
}

export interface Alert {
  id: string;
  keyword: string;
  sources: string[];
  priority: "HIGH" | "MEDIUM" | "LOW";
  score: number;
  timestamp: string;
  leadTimeMinutes: number; // calculated lead time before Google Trends picks it up
  demandScore?: number;
  verdict?: "publish" | "monitor" | "skip";
  scoreBreakdown?: {
    location: number;
    incident: number;
    velocity: number;
    sources: number;
    notoriety: number;
  };
}

export interface Draft {
  id: string;
  alertId: string;
  keyword: string;
  headline: string;
  metaDescription: string;
  body: string;
  timestamp: string;
}

interface DatabaseSchema {
  keywords: string[];
  signals: Signal[];
  alerts: Alert[];
  drafts: Draft[];
  subscriptions: any[]; // VAPID browser push subscriptions
}

const DEFAULT_KEYWORDS = [
  "shooting",
  "lockdown",
  "school lockdown",
  "school shooting",
  "fire",
  "death",
  "power outage",
  "blackout",
  "earthquake",
  "layoff",
  "recall",
  "settlement",
  "strike",
  "explosion",
  "stabbing"
];

class Database {
  private data: DatabaseSchema = {
    keywords: [...DEFAULT_KEYWORDS],
    signals: [],
    alerts: [],
    drafts: [],
    subscriptions: []
  };

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        this.data = {
          keywords: parsed.keywords || [...DEFAULT_KEYWORDS],
          signals: parsed.signals || [],
          alerts: parsed.alerts || [],
          drafts: parsed.drafts || [],
          subscriptions: parsed.subscriptions || []
        };
      } else {
        this.save();
      }
    } catch (err) {
      console.error("Error loading database:", err);
    }
  }

  private save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), "utf-8");
    } catch (err) {
      console.error("Error saving database:", err);
    }
  }

  getKeywords(): string[] {
    return this.data.keywords;
  }

  addKeyword(keyword: string): boolean {
    const term = keyword.trim().toLowerCase();
    if (!term) return false;
    if (!this.data.keywords.includes(term)) {
      this.data.keywords.push(term);
      this.save();
      return true;
    }
    return false;
  }

  removeKeyword(keyword: string): boolean {
    const term = keyword.trim().toLowerCase();
    const index = this.data.keywords.indexOf(term);
    if (index !== -1) {
      this.data.keywords.splice(index, 1);
      this.save();
      return true;
    }
    return false;
  }

  addSignal(signal: Omit<Signal, "id" | "timestamp">): Signal {
    const newSignal: Signal = {
      ...signal,
      id: Math.random().toString(36).substring(2, 11),
      timestamp: new Date().toISOString()
    };
    this.data.signals.unshift(newSignal);
    
    // limit signals array to prevent unbounded memory growth
    if (this.data.signals.length > 500) {
      this.data.signals = this.data.signals.slice(0, 500);
    }
    this.save();
    return newSignal;
  }

  getSignals(limit = 100): Signal[] {
    return this.data.signals.slice(0, limit);
  }

  addAlert(alert: Omit<Alert, "id" | "timestamp">): Alert {
    const newAlert: Alert = {
      ...alert,
      id: Math.random().toString(36).substring(2, 11),
      timestamp: new Date().toISOString()
    };
    this.data.alerts.unshift(newAlert);
    
    if (this.data.alerts.length > 200) {
      this.data.alerts = this.data.alerts.slice(0, 200);
    }
    this.save();
    return newAlert;
  }

  getAlerts(lastHours = 24): Alert[] {
    const cutoff = Date.now() - lastHours * 60 * 60 * 1000;
    return this.data.alerts.filter(
      (a) => new Date(a.timestamp).getTime() > cutoff
    );
  }

  addDraft(draft: Omit<Draft, "id" | "timestamp">): Draft {
    const newDraft: Draft = {
      ...draft,
      id: Math.random().toString(36).substring(2, 11),
      timestamp: new Date().toISOString()
    };
    this.data.drafts.unshift(newDraft);
    if (this.data.drafts.length > 100) {
      this.data.drafts = this.data.drafts.slice(0, 100);
    }
    this.save();
    return newDraft;
  }

  getDrafts(): Draft[] {
    return this.data.drafts;
  }

  addSubscription(sub: any) {
    // Check if subscription already exists to avoid duplication
    const exists = this.data.subscriptions.some(
      (s) => s.endpoint === sub.endpoint
    );
    if (!exists) {
      this.data.subscriptions.push(sub);
      this.save();
    }
  }

  getSubscriptions(): any[] {
    return this.data.subscriptions;
  }

  getStats() {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
    
    // Filter items related to today
    const signalsToday = this.data.signals.filter((s) =>
      s.timestamp.startsWith(todayStr)
    ).length;

    const highAlertsToday = this.data.alerts.filter(
      (a) => a.priority === "HIGH" && a.timestamp.startsWith(todayStr)
    ).length;

    const draftsToday = this.data.drafts.filter((d) =>
      d.timestamp.startsWith(todayStr)
    ).length;

    // Calculate lead time average for Google Trends comparison
    const alertsWithLeadTime = this.data.alerts.filter((a) => a.leadTimeMinutes > 0);
    const avgLeadTime =
      alertsWithLeadTime.length > 0
        ? Math.round(
            alertsWithLeadTime.reduce((sum, a) => sum + a.leadTimeMinutes, 0) /
              alertsWithLeadTime.length
          )
        : 22; // default simulated average lead time

    return {
      signalsToday,
      highAlertsToday,
      draftsToday,
      avgLeadTime
    };
  }
}

export const db = new Database();
