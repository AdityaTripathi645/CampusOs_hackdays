"use client";

import { AlertOctagon, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-line bg-white p-8 text-center shadow-card">
      <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-rose-50 text-rose-600">
        <AlertOctagon className="size-5" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-ink-900">Something went wrong</h2>
      <p className="mt-1 text-sm text-ink-500">
        The page could not be loaded. If this keeps happening, check that the database is running and migrated.
      </p>
      {error.digest && <p className="mt-3 font-mono text-xs text-ink-400">Reference: {error.digest}</p>}
      <Button onClick={reset} variant="secondary" className="mt-6">
        <RotateCcw /> Try again
      </Button>
    </div>
  );
}
