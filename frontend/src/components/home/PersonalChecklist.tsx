"use client";

// =========================================================================
// Alpha India — Personalized Daily Action Checklist for Amit
// =========================================================================

import React, { useState, useEffect } from "react";
import { CheckSquare, Square, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

interface PersonalChecklistProps {
  regimeText?: string;
  className?: string;
}

const DEFAULT_TASKS = [
  { id: "regime", text: "Verify Market Regime & Capital Sizing Multiplier" },
  { id: "priority", text: "Review Today's 3 Priority Focus Moves" },
  { id: "watchlist", text: "Check Starred Stocks Proximity to Breakout Pivot" },
  { id: "sizing", text: "Compute 1R Position Sizing & Copy Bracket Orders" },
];

export default function PersonalChecklist({
  regimeText = "Constructive Growth (1.0x Sizing)",
  className = "",
}: PersonalChecklistProps) {
  const [completed, setCompleted] = useState<Record<string, boolean>>({
    regime: true,
  });
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("alpha_india_amit_checklist");
      if (saved) setCompleted(JSON.parse(saved));
    } catch {}
  }, []);

  const toggleTask = (id: string) => {
    setCompleted((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem("alpha_india_amit_checklist", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const doneCount = Object.values(completed).filter(Boolean).length;
  const progressPct = Math.round((doneCount / DEFAULT_TASKS.length) * 100);

  return (
    <div
      className={`rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#071322] p-3 text-xs transition-all ${className}`}
    >
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 size={15} className="text-emerald-500" />
          <span className="font-extrabold text-slate-900 dark:text-white text-xs">
            Amit&apos;s Daily Routine Checklist
          </span>
          <span className="rounded-full bg-slate-100 dark:bg-slate-900 px-2 py-0.2 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400">
            {doneCount}/{DEFAULT_TASKS.length} Done ({progressPct}%)
          </span>
        </div>

        <div className="flex items-center gap-2 text-slate-400">
          <div className="h-1.5 w-16 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
          {DEFAULT_TASKS.map((task) => {
            const isDone = Boolean(completed[task.id]);
            return (
              <div
                key={task.id}
                onClick={() => toggleTask(task.id)}
                className="flex items-center gap-2.5 cursor-pointer p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900/60 transition"
              >
                {isDone ? (
                  <CheckSquare size={15} className="text-emerald-500 shrink-0" />
                ) : (
                  <Square size={15} className="text-slate-400 shrink-0" />
                )}
                <span
                  className={`text-xs ${
                    isDone
                      ? "line-through text-slate-400 dark:text-slate-500"
                      : "text-slate-800 dark:text-slate-200 font-medium"
                  }`}
                >
                  {task.text}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
