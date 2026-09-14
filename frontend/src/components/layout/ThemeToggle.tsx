"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

interface ThemeToggleProps {
  className?: string;
}

export default function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={`h-9 w-9 rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900 ${className}`}
        aria-hidden="true"
      />
    );
  }

  const currentTheme = theme === "system" ? resolvedTheme : theme;
  const isDark = currentTheme === "dark";

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      className={`group relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 shadow-xs transition-all duration-200 hover:border-cyan-500/50 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-cyan-500/40 dark:hover:bg-slate-800 dark:hover:text-white ${className}`}
    >
      {isDark ? (
        <Sun
          size={16}
          className="text-amber-400 transition-transform duration-300 group-hover:rotate-45"
        />
      ) : (
        <Moon
          size={16}
          className="text-indigo-600 transition-transform duration-300 group-hover:-rotate-12"
        />
      )}
    </button>
  );
}
