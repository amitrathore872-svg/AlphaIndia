"use client";

import { useEffect, useRef, memo } from "react";

interface TradingViewNativeWidgetProps {
  symbol: string;
  exchange?: string;
  height?: number | string;
  theme?: "dark" | "light";
  interval?: string;
}

function TradingViewNativeWidgetComponent({
  symbol,
  exchange = "NSE",
  height = 580,
  theme = "dark",
  interval = "D",
}: TradingViewNativeWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanSym = symbol.replace(/\.NS$|\.BO$/i, "").toUpperCase();
  const tvSymbol = `${exchange}:${cleanSym}`;

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = "";

    const containerId = `tv_chart_container_${cleanSym}_${Math.random().toString(36).substring(2, 9)}`;
    const widgetDiv = document.createElement("div");
    widgetDiv.id = containerId;
    widgetDiv.style.width = "100%";
    widgetDiv.style.height = typeof height === "number" ? `${height}px` : height;
    containerRef.current.appendChild(widgetDiv);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => {
      if (typeof (window as any).TradingView !== "undefined") {
        new (window as any).TradingView.widget({
          autosize: true,
          symbol: tvSymbol,
          interval: interval,
          timezone: "Asia/Kolkata",
          theme: theme,
          style: "1",
          locale: "in",
          toolbar_bg: theme === "dark" ? "#050B14" : "#f1f3f6",
          enable_publishing: false,
          allow_symbol_change: false,
          container_id: containerId,
          hide_side_toolbar: false,
          studies: [
            "MASimple@tv-basicstudies",
            "RSI@tv-basicstudies",
            "Volume@tv-basicstudies"
          ],
        });
      }
    };

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [cleanSym, exchange, height, theme, interval, tvSymbol]);

  return (
    <div className="relative w-full h-full flex flex-col flex-1 min-h-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#050B14] shadow-2xl">
      <div ref={containerRef} className="w-full h-full flex-1" style={{ height: typeof height === "number" ? `${height}px` : (height || "100%") }} />
    </div>
  );
}

export default memo(TradingViewNativeWidgetComponent);
