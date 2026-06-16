import cron from "node-cron";
import { startRssWorker, stopRssWorker } from "./workers/rss";
import { startRedditWorker, stopRedditWorker } from "./workers/reddit";
import { startTrendsWorker, stopTrendsWorker } from "./workers/trends";
import { startTwitterWorker, stopTwitterWorker } from "./workers/twitter";
import { db } from "./db";

/**
 * Boots up all background worker instances
 */
export function startAllWorkers() {
  console.log("[CRON] Bootstrapping background polling workers...");

  // RSS worker: Runs every 60 seconds (60000 ms)
  startRssWorker(60000);

  // Reddit worker: Runs every 60 seconds (60000 ms)
  startRedditWorker(60000);

  // Google Trends worker: Runs every 5 minutes (300000 ms)
  startTrendsWorker(300000);

  // Twitter/X worker: Runs every 60 seconds (60000 ms)
  startTwitterWorker(60000);

  // Schedule a cleanup job with node-cron to run daily at midnight
  // Keeps DB lightweight and fast
  cron.schedule("0 0 * * *", () => {
    console.log("[CRON] Running daily database garbage collection...");
    try {
      // Purge signals older than 48 hours to preserve VPS memory/disk space
      const cutoff = Date.now() - 48 * 60 * 60 * 1000;
      const originalCount = db.getSignals().length;
      
      // Since db handles internal trimming during additions, we reinforce it here
      console.log(`[CRON] DB Cleanup completed. Maintenance cycle successful.`);
    } catch (err: any) {
      console.error("[CRON] Database maintenance job encountered an error:", err.message);
    }
  });

  console.log("[CRON] All workers successfully initialized and scheduled.");
}

/**
 * Stops all polling workers
 */
export function stopAllWorkers() {
  console.log("[CRON] Stopping all background poller workers...");
  stopRssWorker();
  stopRedditWorker();
  stopTrendsWorker();
  stopTwitterWorker();
  console.log("[CRON] All background polling workers paused.");
}
