"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

interface MermaidViewerProps {
  chart: string;
  className?: string;
  minWidth?: number;
}

export const MermaidViewer: React.FC<MermaidViewerProps> = ({
  chart,
  className = "",
  minWidth = 540,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rawId = useId();
  const safeId = `mermaid_${rawId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const [svgContent, setSvgContent] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    const renderChart = async () => {
      try {
        const mermaidModule = await import("mermaid");
        const mermaid = mermaidModule.default || mermaidModule;

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "loose",
          theme: "base",
          themeVariables: {
            primaryColor: "#E7D9C9",
            primaryTextColor: "#1E293B",
            primaryBorderColor: "#C15C3D",
            lineColor: "#64748B",
            secondaryColor: "#FEF3C7",
            tertiaryColor: "#F1F5F9",
            activeTaskColor: "#C15C3D",
            activeTaskBorderColor: "#9A3412",
            critBkgColor: "#FEE2E2",
            critBorderColor: "#EF4444",
            milestoneBkgColor: "#FEF3C7",
            milestoneBorderColor: "#D97706",
            gridColor: "#E2E8F0",
            todayLineColor: "#C15C3D",
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: "12px",
          },
          gantt: {
            axisFormat: "%d/%m",
            barHeight: 24,
            barGap: 6,
            topPadding: 32,
            titleTopMargin: 20,
          },
        });

        // ID unique pour éviter collisions DOM
        const uniqueId = `${safeId}_${Math.random().toString(36).slice(2, 8)}`;
        const { svg } = await mermaid.render(uniqueId, chart);

        if (isMounted) {
          setSvgContent(svg);
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error("Erreur rendu Mermaid Gantt :", err);
          setError(err?.message || "Impossible de générer le diagramme de planning.");
          setLoading(false);
        }
      }
    };

    renderChart();

    return () => {
      isMounted = false;
    };
  }, [chart, safeId]);

  return (
    <div className={`w-full overflow-x-auto rounded-xl bg-white ${className}`}>
      {loading && (
        <div className="flex items-center justify-center p-8 text-bna-muted gap-2 text-xs">
          <Loader2 className="w-4 h-4 animate-spin text-bna-copper" />
          <span>Génération du planning Gantt Mermaid.js...</span>
        </div>
      )}

      {error && (
        <div className="p-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
          <p className="font-bold">Aperçu texte du planning général :</p>
          <pre className="text-[10px] font-mono whitespace-pre-wrap text-slate-700 bg-white p-2 rounded border border-amber-200 overflow-x-auto">
            {chart}
          </pre>
        </div>
      )}

      {!loading && !error && svgContent && (
        <div
          ref={containerRef}
          style={{ minWidth: `${minWidth}px` }}
          className="p-2 select-none [&_svg]:w-full [&_svg]:h-auto [&_.today]:stroke-bna-copper [&_.today]:stroke-2"
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      )}
    </div>
  );
};
