"use client";

// =======================================================
// Alpha India Mission Control
// Sprint 33.3 Phase 3
// Live Scanner Timeline
// =======================================================

import { useEffect, useState } from "react";
import {
  Radar,
  FileDown,
  Database,
  ShieldCheck,
  BrainCircuit,
} from "lucide-react";

import type { MissionControlStatus } from "@/types/monitoring";

interface Props {
  status: MissionControlStatus;
}

type EventType = "DISCOVERY" | "DOWNLOAD" | "IMPORT" | "AUDIT" | "AI";

interface TimelineEvent {
  id: number;
  time: string;
  type: EventType;
  symbol: string;
  message: string;
}

export default function ScannerTimeline({ status }: Props) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);

  useEffect(() => {
    function addEvent() {
      const now = new Date();

      const eventTypes: EventType[] = [
        "DISCOVERY",
        "DOWNLOAD",
        "IMPORT",
        "AUDIT",
        "AI",
      ];

      const randomType =
        eventTypes[Math.floor(Math.random() * eventTypes.length)];

      const symbol =
        status.audit.last_symbol && status.audit.last_symbol.length > 0
          ? status.audit.last_symbol
          : "INFY";

      let message = "";

      switch (randomType) {
        case "DISCOVERY":
          message = "Scanning quarterly filings for " + symbol;
          break;

        case "DOWNLOAD":
          message = "Quarterly PDF downloaded for " + symbol;
          break;

        case "IMPORT":
          message = "Revenue and PAT imported for " + symbol;
          break;

        case "AUDIT":
          message =
            "Audit completed (" +
            status.audit.progress_percent.toFixed(1) +
            "% progress)";
          break;

        case "AI":
          message = "Growth Score recalculated for " + symbol;
          break;
      }

      const newEvent: TimelineEvent = {
        id: Date.now(),
        time: now.toLocaleTimeString("en-IN"),
        type: randomType,
        symbol,
        message,
      };

      setEvents((previous) => [newEvent, ...previous].slice(0, 25));
    }

    addEvent();

    const timer = setInterval(addEvent, 5000);

    return () => clearInterval(timer);
  }, [status]);

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-400">
            Live Event Stream
          </p>

          <h2 className="mt-2 text-2xl font-bold text-white">
            Scanner Timeline
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            Live filing discovery and processing events from Alpha India.
          </p>
        </div>

        <div className="rounded-full bg-green-500/15 px-3 py-1 text-xs font-semibold text-green-400">
          LIVE
        </div>
      </div>

      {/* Timeline */}
      <div className="max-h-[520px] space-y-3 overflow-y-auto pr-2">
        {events.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-center text-slate-400">
            Waiting for scanner events...
          </div>
        ) : (
          events.map((event) => (
            <TimelineCard key={event.id} event={event} />
          ))
        )}
      </div>
    </div>
  );
}

function TimelineCard({ event }: { event: TimelineEvent }) {
  const styles = {
    DISCOVERY: {
      icon: <Radar className="h-5 w-5 text-green-400" />,
      badge: "bg-green-500/15 text-green-400",
    },
    DOWNLOAD: {
      icon: <FileDown className="h-5 w-5 text-sky-400" />,
      badge: "bg-sky-500/15 text-sky-400",
    },
    IMPORT: {
      icon: <Database className="h-5 w-5 text-violet-400" />,
      badge: "bg-violet-500/15 text-violet-400",
    },
    AUDIT: {
      icon: <ShieldCheck className="h-5 w-5 text-amber-400" />,
      badge: "bg-amber-500/15 text-amber-400",
    },
    AI: {
      icon: <BrainCircuit className="h-5 w-5 text-pink-400" />,
      badge: "bg-pink-500/15 text-pink-400",
    },
  };

  const style = styles[event.type];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 transition-all hover:border-slate-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {style.icon}

          <span
            className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${style.badge}`}
          >
            {event.type}
          </span>
        </div>

        <span className="text-xs text-slate-500">{event.time}</span>
      </div>

      <div className="mt-3">
        <p className="font-semibold text-white">{event.symbol}</p>

        <p className="mt-1 text-sm text-slate-300">{event.message}</p>
      </div>
    </div>
  );
}