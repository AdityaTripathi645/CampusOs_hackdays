import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="bg-grid flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md rounded-2xl border border-line bg-white p-8 text-center shadow-card">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          <Compass className="size-5" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-ink-900">Page not found</h1>
        <p className="mt-1 text-sm text-ink-500">
          This page doesn&apos;t exist, or you don&apos;t have access to it.
        </p>
        <Button asChild variant="secondary" className="mt-6">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
