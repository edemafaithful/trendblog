import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { Signal, Alert, Draft } from "../../server/db";

export interface SystemStats {
  signalsToday: number;
  highAlertsToday: number;
  draftsToday: number;
  avgLeadTime: number;
}

export function useSocket() {
  const [connected, setConnected] = useState(false);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [stats, setStats] = useState<SystemStats>({
    signalsToday: 0,
    highAlertsToday: 0,
    draftsToday: 0,
    avgLeadTime: 22
  });

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Standard Socket.io auto-connection (detects origin/ports beautifully)
    const socket = io({
      reconnectionAttempts: 10,
      reconnectionDelay: 2000
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      console.log("[SOCKET] Connected to breaking news stream channel.");
    });

    socket.on("disconnect", () => {
      setConnected(false);
      console.log("[SOCKET] Signal channel disconnected.");
    });

    // Seeding handshake payload
    socket.on("init", (data: {
      signals: Signal[];
      alerts: Alert[];
      drafts: Draft[];
      keywords: string[];
      stats: SystemStats;
    }) => {
      setSignals(data.signals);
      setAlerts(data.alerts);
      setDrafts(data.drafts);
      setKeywords(data.keywords);
      setStats(data.stats);
    });

    // Single signal trigger
    socket.on("signal", (signal: Signal) => {
      setSignals((prev) => {
        // Avoid duplicate items
        if (prev.some((s) => s.id === signal.id)) return prev;
        return [signal, ...prev].slice(0, 150); // clamp stream to recent 150
      });
    });

    // Single alert trigger
    socket.on("alert", (alert: Alert) => {
      setAlerts((prev) => {
        if (prev.some((a) => a.id === alert.id)) return prev;
        return [alert, ...prev];
      });
    });

    // Single generated article draft trigger
    socket.on("draft", (draft: Draft) => {
      setDrafts((prev) => {
        if (prev.some((d) => d.id === draft.id)) return prev;
        return [draft, ...prev];
      });
    });

    // Stats updates
    socket.on("stats_update", (updatedStats: SystemStats) => {
      setStats(updatedStats);
    });

    // Monitored keywords updates
    socket.on("keywords_update", (updatedKeywords: string[]) => {
      setKeywords(updatedKeywords);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return {
    connected,
    signals,
    alerts,
    drafts,
    keywords,
    stats,
    socket: socketRef.current
  };
}
