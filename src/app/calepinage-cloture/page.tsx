"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ClotureCalepinagePanel } from "@/components/calepinage/ClotureCalepinagePanel";

export default function CalepinageCloturePage(): React.ReactElement {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-orange-400" />
            <span>Retour au tableau de bord BNA</span>
          </Link>
        </div>

        <ClotureCalepinagePanel />
      </div>
    </main>
  );
}
