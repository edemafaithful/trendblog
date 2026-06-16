import Parser from "rss-parser";
import axios from "axios";
import { db } from "../db";
import { aggregator } from "../aggregator";

// 10 high-quality, real US news feed URLs
const RSS_FEEDS = [
  { name: "NBC News Top Stories", url: "https://feeds.nbcnews.com/nbcnews/public/news" },
  { name: "CNBC Top News", url: "https://search.cnbc.com/rs/search/view.xml?partnerId=2000&keywords=news" },
  { name: "ABC News Top stories", url: "https://abcnews.go.com/abcnews/topstories" },
  { name: "NPR National News", url: "https://feeds.npr.org/1001/rss.xml" },
  { name: "KTLA Local News", url: "https://ktla.com/news/feed/" },
  { name: "KRON4 California News", url: "https://www.kron4.com/news/feed/" },
  { name: "WGN Chicago News", url: "https://wgntv.com/news/feed/" },
  { name: "CBS News Global", url: "https://www.cbsnews.com/latest/rss/main" },
  { name: "Slate Magazine Feed", url: "https://slate.com/feeds/all.rss" },
  { name: "Yahoo US News Feed", url: "https://news.yahoo.com/rss/" }
];

const parser = new Parser({
  timeout: 5000,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) TrendRadar/1.0.0"
  }
});

let intervalId: NodeJS.Timeout | null = null;
export let isRssOffline = false;

// Track already matched item URLs to prevent spamming duplicate signals
const matchedUrls = new Set<string>();

/**
 * Single polling scan across all 10 custom RSS feeds
 */
export async function scanRssFeeds() {
  const keywords = db.getKeywords();
  if (keywords.length === 0) return;

  console.log(`[RSS WORKER] Scanning ${RSS_FEEDS.length} RSS feeds for ${keywords.length} monitored keywords...`);

  // We track transient feed matches per keyword to allow cross-feed velocity grouping
  const keywordFeedCount = new Map<string, number>();
  const activeMatches: Array<{
    keyword: string;
    feedName: string;
    title: string;
    content: string;
    url: string;
    pubDate: string;
  }> = [];

  for (const feed of RSS_FEEDS) {
    try {
      // Fetch feeds safely with a timeout
      const response = await axios.get(feed.url, { 
        timeout: 4000,
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) TrendRadar/1.0.0" }
      });
      const parsedFeed = await parser.parseString(response.data);
      
      const items = parsedFeed.items || [];

      for (const item of items) {
        const title = item.title || "";
        const description = item.contentSnippet || item.content || "";
        const url = item.link || "";
        const pubDateStr = item.pubDate || item.isoDate || new Date().toISOString();

        if (!title || matchedUrls.has(url)) continue;

        const combinedText = `${title} ${description}`.toLowerCase();

        // Check if any monitored keyword matches
        for (const kw of keywords) {
          const regex = new RegExp(`\\b${kw.toLowerCase()}\\b`, "i");
          if (regex.test(combinedText)) {
            // Found a match!
            activeMatches.push({
              keyword: kw,
              feedName: feed.name,
              title,
              content: description.substring(0, 300),
              url,
              pubDate: pubDateStr
            });

            // Increment frequency count for velocity scoring
            keywordFeedCount.set(kw, (keywordFeedCount.get(kw) || 0) + 1);
            matchedUrls.add(url);
            break; // match first keyword and avoid duplicate triggers for same item
          }
        }
      }
    } catch (err: any) {
      console.log(`[RSS WORKER] Feed "${feed.name}" status: quiet (${err.message.substring(0, 30)})`);
    }
  }

  // Handle all matches found in this scan
  if (activeMatches.length === 0) {
    console.log("[RSS WORKER] No keyword matches detected in RSS feeds.");
    isRssOffline = false;
    return;
  }

  isRssOffline = false;

  console.log(`[RSS WORKER] Scanning complete. Found ${activeMatches.length} matching entries.`);

  for (const match of activeMatches) {
    const pubTime = new Date(match.pubDate).getTime();
    const ageMs = Math.max(0, Date.now() - pubTime);
    const ageMinutes = ageMs / (60 * 1000);

    // Calculate Recency Decay: Max of 50 points if brand new, decays to 5 points over 2 hours
    const recencyWeight = Math.round(45 * Math.exp(-ageMinutes / 90)) + 5;

    // Calculate Feed Pickups Weight: how many feeds in this batch picked up the exact same keyword prefix
    const globalCount = keywordFeedCount.get(match.keyword) || 1;
    const concurrentWeight = Math.min(globalCount * 12, 50); // maximum 50 points

    // Combined RSS Velocity Score (min 10, max 100)
    const velocityScore = Math.min(Math.max(recencyWeight + concurrentWeight, 10), 100);

    // Format signal object and pass to aggregator
    aggregator.addSignal({
      keyword: match.keyword,
      source: "rss",
      sourceName: match.feedName,
      title: match.title,
      description: match.content,
      url: match.url,
      velocity: velocityScore
    });
  }
}

/**
 * Set up continuous interval scanning
 */
export function startRssWorker(intervalMs = 60000) {
  if (intervalId) return;

  // Run immediate first scan
  scanRssFeeds().catch((err) => {
    console.error("[RSS WORKER] Initial feed scanning error:", err);
  });

  intervalId = setInterval(() => {
    scanRssFeeds().catch((err) => {
      console.error("[RSS WORKER] Polling feed scanning error:", err);
    });
  }, intervalMs);

  console.log(`[RSS WORKER] Poller initiated successfully (scanning every ${intervalMs / 1000}s)`);
}

export function stopRssWorker() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[RSS WORKER] Poller stopped.");
  }
}
