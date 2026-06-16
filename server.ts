import express from "express";
import http from "http";
import path from "path";
import { Server as SocketServer } from "socket.io";
import { createServer as createViteServer } from "vite";
import { db } from "./server/db";
import { aggregator } from "./server/aggregator";
import { alertEngine } from "./server/alertEngine";
import { startAllWorkers, stopAllWorkers } from "./server/cron";
import dotenv from "dotenv";

// Load local environment variables
dotenv.config();

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json());

  // Create unified HTTP Server to support both Express and Socket.io side-by-side
  const httpServer = http.createServer(app);
  
  // Initialize Socket.io on our server Instance
  const io = new SocketServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Link Socket.io server to our AlertEngine
  alertEngine.setSocketServer(io);

  // Relay real-time signals from Aggregator events to Socket.io clients
  aggregator.on("new_signal", (signal) => {
    io.emit("signal", signal);
    // Push updated stats dynamically
    io.emit("stats_update", db.getStats());
  });

  // Socket.io Connection lifecycle
  io.on("connection", (socket) => {
    console.log(`[SOCKET] Client connected: ${socket.id}`);
    
    // Instantly seed the newly connected client with active data states (Prevents flickering/loading states)
    socket.emit("init", {
      signals: db.getSignals(100),
      alerts: db.getAlerts(24),
      drafts: db.getDrafts(),
      keywords: db.getKeywords(),
      stats: db.getStats()
    });

    socket.on("disconnect", () => {
      console.log(`[SOCKET] Client disconnected: ${socket.id}`);
    });
  });

  // ==========================================
  // CENTRAL REST API ENDPOINTS
  // ==========================================

  // GET /api/signals : Returns last 100 signals
  app.get("/api/signals", (req, res) => {
    res.json(db.getSignals(100));
  });

  // GET /api/alerts : Returns all alerts in last 24 hours
  app.get("/api/alerts", (req, res) => {
    res.json(db.getAlerts(24));
  });

  // GET /api/drafts : Returns all generated article drafts
  app.get("/api/drafts", (req, res) => {
    res.json(db.getDrafts());
  });

  // POST /api/drafts/generate : Triggers a manual draft generation
  app.post("/api/drafts/generate", async (req, res) => {
    const { alertId, keyword } = req.body;
    if (!alertId || !keyword) {
      res.status(400).json({ error: "alertId and keyword parameters are required" });
      return;
    }

    try {
      const { generateArticleDraft } = await import("./server/articleGenerator");
      const draft = await generateArticleDraft(alertId, keyword);
      io.emit("draft", draft);
      io.emit("stats_update", db.getStats());
      res.status(201).json(draft);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to generate draft structure" });
    }
  });

  // GET /api/keywords : Returns monitored keywords list
  app.get("/api/keywords", (req, res) => {
    res.json(db.getKeywords());
  });

  // POST /api/keywords : Adds a keyword
  app.post("/api/keywords", (req, res) => {
    const { keyword } = req.body;
    if (!keyword || typeof keyword !== "string") {
      res.status(400).json({ error: "Invalid keyword format" });
      return;
    }
    
    const added = db.addKeyword(keyword);
    if (added) {
      // Broadcast updated list to all active dashboard users
      io.emit("keywords_update", db.getKeywords());
      res.status(201).json({ success: true, keywords: db.getKeywords() });
    } else {
      res.status(400).json({ error: "Keyword already monitored or empty" });
    }
  });

  // DELETE /api/keywords/:kw : Removes a keyword
  app.delete("/api/keywords/:kw", (req, res) => {
    const kw = req.params.kw;
    if (!kw) {
      res.status(400).json({ error: "Keyword parameter required" });
      return;
    }

    const removed = db.removeKeyword(kw);
    if (removed) {
      // Broadcast updated list to all active dashboard users
      io.emit("keywords_update", db.getKeywords());
      res.json({ success: true, keywords: db.getKeywords() });
    } else {
      res.status(404).json({ error: "Keyword not found in monitored list" });
    }
  });

  // GET /api/stats : Returns metric cards statistics
  app.get("/api/stats", (req, res) => {
    res.json(db.getStats());
  });

  // GET /api/notifications/vapid-key : Returns VAPID public key for browser push subscription
  app.get("/api/notifications/vapid-key", (req, res) => {
    res.json({ publicKey: alertEngine.vapidPublicKey });
  });

  // POST /api/notifications/subscribe : Registers a client subscription object for push notifications
  app.post("/api/notifications/subscribe", (req, res) => {
    const subscription = req.body;
    if (!subscription || !subscription.endpoint) {
       res.status(400).json({ error: "Invalid subscription details" });
       return;
    }
    db.addSubscription(subscription);
    res.status(201).json({ success: true });
  });

  // ==========================================
  // VITE SERVICE MIDDLEWARE MOUNTING
  // ==========================================
  if (process.env.NODE_ENV !== "production") {
    // Development mode is running - mount standard Vite HMR proxies
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
    console.log("[SERVER] Vite Dev Middleware mounted.");
  } else {
    // Production mode is running - serve optimized assets from /dist
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("[SERVER] Serving static SPA assets from /dist.");
  }

  // ==========================================
  // BACKGROUND SYSTEM INITIATION
  // ==========================================
  startAllWorkers();

  // Bind server listener to port 3000 across 0.0.0.0
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`====================================================`);
    console.log(`🚀 Trend Radar Full-Stack Server running on Port 3000`);
    console.log(`🚀 Open Dev Link: http://localhost:3000`);
    console.log(`====================================================`);
  });

  // Handle server tear down gracefully on process exit
  process.on("SIGTERM", () => {
    stopAllWorkers();
    httpServer.close(() => {
      console.log("Trend Radar server offline.");
    });
  });
}

startServer().catch((err) => {
  console.error("Critical crash during server initiation stage:", err);
});
