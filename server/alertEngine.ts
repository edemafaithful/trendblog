import webpush from "web-push";
import { Server as SocketServer } from "socket.io";
import { db, Alert } from "./db";
import { aggregator } from "./aggregator";
import { generateArticleDraft } from "./articleGenerator";

// Configure Web Push VAPID credentials
let vapidPublicKey = process.env.VAPID_PUBLIC_KEY || "";
let vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "";
const alertEmail = process.env.ALERT_EMAIL || "mailto:dev@trendradar.io";

// Auto-generate VAPID keys if they are not provided, ensuring seamless demo capabilities
if (!vapidPublicKey || !vapidPrivateKey) {
  try {
    const keys = webpush.generateVAPIDKeys();
    vapidPublicKey = keys.publicKey;
    vapidPrivateKey = keys.privateKey;
    console.log("====================================================");
    console.log("Trend Radar: Generated dynamic VAPID Keys on startup:");
    console.log("Public Key:", vapidPublicKey);
    console.log("Private Key:", vapidPrivateKey);
    console.log("====================================================");
  } catch (err) {
    console.error("Failed to generate VAPID keys:", err);
  }
}

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(alertEmail, vapidPublicKey, vapidPrivateKey);
  } catch (err) {
    console.error("Failed to set VAPID details:", err);
  }
}

class AlertEngine {
  private io: SocketServer | null = null;
  // Expose the active public key so the client API can fetch it dynamically
  public readonly vapidPublicKey = vapidPublicKey;

  constructor() {
    // Listen for cross-source spikes detected by the Aggregator
    aggregator.on("spike_detected", async (data) => {
      await this.handleSpike(data);
    });
  }

  public setSocketServer(io: SocketServer) {
    this.io = io;
  }

  /**
   * Process a spike event and publish it across WebSockets and WebPush
   */
  private async handleSpike(data: {
    keyword: string;
    sources: string[];
    priority: "HIGH" | "MEDIUM" | "LOW";
    score: number;
    leadTimeMinutes: number;
    demandScore: number;
    verdict: "publish" | "monitor" | "skip";
    scoreBreakdown: {
      location: number;
      incident: number;
      velocity: number;
      sources: number;
      notoriety: number;
    };
  }) {
    // Only call fireAlert() when verdict !== 'skip'.
    if (data.verdict === "skip") {
      console.log(`[ALERT ENGINE] Skipping fireAlert and database addition for "${data.keyword}" due to "skip" verdict.`);
      return;
    }

    // 1. Persist alert to database with demandScore, verdict, and scoreBreakdown
    const savedAlert = db.addAlert({
      keyword: data.keyword,
      sources: data.sources,
      priority: data.priority,
      score: data.score,
      leadTimeMinutes: data.leadTimeMinutes,
      demandScore: data.demandScore,
      verdict: data.verdict,
      scoreBreakdown: data.scoreBreakdown
    });

    console.log(`[ALERT ENGINE] Created ${data.priority} alert for keyword "${data.keyword}" (score: ${data.score}, demandScore: ${data.demandScore}, verdict: ${data.verdict})`);

    // 2. Broadcast & Publish Alert details (this represents the fireAlert action)
    this.fireAlert(savedAlert);

    // 3. Trigger AI article generation automatically ONLY when verdict === 'publish'
    if (data.verdict === "publish") {
      await this.generateArticle(savedAlert);
    }
  }

  /**
   * Fires the alert across internal IO and external WebPush channels
   */
  private fireAlert(alert: Alert) {
    if (this.io) {
      this.io.emit("alert", alert);
      this.io.emit("stats_update", db.getStats());
    }

    // Dispatch web push notifications to browser clients
    this.sendPushNotification(alert);
  }

  /**
   * Generates the article draft based on the alert
   */
  private async generateArticle(alert: Alert) {
    await this.triggerAutoArticleGeneration(alert);
  }

  /**
   * Submits Web Push payloads to all active browser subscriptions
   */
  private sendPushNotification(alert: Alert) {
    const subscriptions = db.getSubscriptions();
    if (subscriptions.length === 0) {
      return;
    }

    const payload = JSON.stringify({
      title: `🚨 Trend Radar Status: ${alert.priority} Signal`,
      body: `Keyword "${alert.keyword}" is spiking at score ${alert.score}! Confirmed on sources: ${alert.sources.join(", ")}.`,
      priority: alert.priority,
      tag: alert.keyword,
      url: "/"
    });

    console.log(`[ALERT ENGINE] Sending push notification to ${subscriptions.length} subscribers...`);

    subscriptions.forEach((sub, idx) => {
      webpush
        .sendNotification(sub, payload)
        .catch((err) => {
          console.error(`Failed to send web push notification index ${idx}:`, err.statusCode || err.message);
          // If subscription is expired or invalid (404, 410), we can ideally prune it
        });
    });
  }

  /**
   * Initiates the AI pipeline to build publish-ready news articles
   */
  private async triggerAutoArticleGeneration(alert: Alert) {
    try {
      console.log(`[ALERT ENGINE] Auto-generating article draft for keyword "${alert.keyword}"`);
      const draft = await generateArticleDraft(alert.id, alert.keyword);
      
      // Send draft to clients so it pops up in the UI automatically
      if (this.io) {
        this.io.emit("draft", draft);
        this.io.emit("stats_update", db.getStats());
      }
      console.log(`[ALERT ENGINE] Successfully generated draft for "${alert.keyword}" (Draft Headline: "${draft.headline}")`);
    } catch (err) {
      console.error(`Failed auto-generating article draft for keyword "${alert.keyword}":`, err);
    }
  }
}

export const alertEngine = new AlertEngine();
export { vapidPublicKey };
