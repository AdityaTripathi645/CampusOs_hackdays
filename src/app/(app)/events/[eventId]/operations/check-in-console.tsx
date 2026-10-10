"use client";

import * as React from "react";
import { useActionState, useTransition } from "react";
import { Camera, CameraOff, CheckCircle2, CircleHelp, Loader2, ScanLine, ShieldAlert, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/inputs";
import { checkInAction, type CheckInState } from "@/actions/staff";
import { cn } from "@/lib/utils";

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

export function CheckInConsole({ eventId }: { eventId: string }) {
  const [state, formAction] = useActionState<CheckInState, FormData>(checkInAction, { ok: false });
  const [pending, start] = useTransition();
  const [code, setCode] = React.useState("");
  const [camera, setCamera] = React.useState<"off" | "on" | "unsupported" | "denied">("off");
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const lastScan = React.useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const inputRef = React.useRef<HTMLInputElement>(null);

  const submit = React.useCallback(
    (value: string, method: "QR" | "MANUAL") => {
      const v = value.trim();
      if (!v) return;
      const fd = new FormData();
      fd.set("eventId", eventId);
      fd.set("code", v);
      fd.set("method", method);
      start(() => formAction(fd));
      setCode("");
    },
    [eventId, formAction],
  );

  const stopCamera = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamera((c) => (c === "on" ? "off" : c));
  }, []);

  React.useEffect(() => () => stopCamera(), [stopCamera]);

  const startCamera = async () => {
    const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    if (!BD || !navigator.mediaDevices?.getUserMedia) {
      setCamera("unsupported");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setCamera("on");
      const detector = new BD({ formats: ["qr_code"] });
      requestAnimationFrame(async function loop() {
        const video = videoRef.current;
        if (!streamRef.current || !video) return;
        if (video.srcObject !== stream) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        try {
          const codes = await detector.detect(video);
          const raw = codes[0]?.rawValue;
          const now = Date.now();
          // Debounce repeated reads of the same badge.
          if (raw && (raw !== lastScan.current.code || now - lastScan.current.at > 4000)) {
            lastScan.current = { code: raw, at: now };
            submit(raw, "QR");
          }
        } catch {
          /* frame not ready */
        }
        if (streamRef.current) setTimeout(() => requestAnimationFrame(loop), 250);
      });
    } catch {
      setCamera("denied");
    }
  };

  const r = state.result;
  const tone =
    !r ? null : r.status === "checked_in" ? "success" : r.status === "already" ? "info" : r.status === "not_approved" ? "warning" : "danger";

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(code, "MANUAL");
            inputRef.current?.focus();
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <ScanLine className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
            <Input
              ref={inputRef}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Scan badge or type code (CO-…)"
              className="h-12 pl-9 font-mono uppercase tracking-wider"
              aria-label="Check-in code"
            />
          </div>
          <Button type="submit" size="lg" disabled={pending || !code.trim()}>
            {pending ? <Loader2 className="animate-spin" /> : "Check in"}
          </Button>
        </form>
        <p className="text-xs text-ink-500">
          USB/Bluetooth QR scanners type into this field and press Enter. Phone cameras work in browsers that support the
          BarcodeDetector API (Chrome, Edge, Android).
        </p>

        <div className="overflow-hidden rounded-2xl border border-line bg-ink-950">
          {camera === "on" ? (
            <div className="relative">
              <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
              <div className="pointer-events-none absolute inset-[18%] rounded-2xl border-2 border-white/70" />
              <Button type="button" variant="secondary" size="sm" className="absolute bottom-3 right-3" onClick={stopCamera}>
                <CameraOff /> Stop camera
              </Button>
            </div>
          ) : (
            <div className="flex aspect-video flex-col items-center justify-center gap-3 p-6 text-center text-sm text-ink-300">
              <Camera className="size-8 text-ink-500" />
              {camera === "unsupported" && <p>This browser can&apos;t scan QR codes from the camera. Use a scanner or type the code.</p>}
              {camera === "denied" && <p>Camera permission was denied.</p>}
              <Button type="button" variant="secondary" size="sm" onClick={startCamera}>
                <Camera /> Start camera scanner
              </Button>
            </div>
          )}
        </div>
      </div>

      <div
        className={cn(
          "flex min-h-64 flex-col items-center justify-center rounded-2xl border p-8 text-center transition",
          !r && "border-dashed border-line bg-white",
          tone === "success" && "border-emerald-200 bg-emerald-50",
          tone === "info" && "border-sky-200 bg-sky-50",
          tone === "warning" && "border-amber-200 bg-amber-50",
          tone === "danger" && "border-rose-200 bg-rose-50",
        )}
        aria-live="polite"
      >
        {state.error && <p className="text-sm font-medium text-rose-700">{state.error}</p>}
        {!r && !state.error && (
          <>
            <ScanLine className="size-10 text-ink-300" />
            <p className="mt-3 text-sm text-ink-500">Waiting for the first scan…</p>
          </>
        )}
        {r?.status === "checked_in" && (
          <>
            <CheckCircle2 className="size-12 text-emerald-600" />
            <p className="mt-3 text-xl font-bold text-ink-950">{r.name}</p>
            <p className="text-sm text-ink-600">{r.email}</p>
            <p className="mt-3 rounded-full bg-white px-3 py-1 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200">
              Checked in{r.seat ? ` · ${r.seat}` : ""}
            </p>
          </>
        )}
        {r?.status === "already" && (
          <>
            <History className="size-12 text-sky-600" />
            <p className="mt-3 text-xl font-bold text-ink-950">{r.name}</p>
            <p className="text-sm text-ink-600">Already checked in at {new Date(r.at).toLocaleTimeString()}</p>
            {r.seat && <p className="mt-2 text-sm font-semibold text-sky-700">{r.seat}</p>}
          </>
        )}
        {r?.status === "not_approved" && (
          <>
            <ShieldAlert className="size-12 text-amber-600" />
            <p className="mt-3 text-xl font-bold text-ink-950">{r.name}</p>
            <p className="text-sm text-amber-800">Registration is {r.registrationStatus.toLowerCase()} — approve it before check-in.</p>
          </>
        )}
        {r?.status === "unknown" && (
          <>
            <CircleHelp className="size-12 text-rose-600" />
            <p className="mt-3 text-lg font-bold text-ink-950">Code not recognised</p>
            <p className="text-sm text-rose-800">No registration with this code exists for this event.</p>
          </>
        )}
      </div>
    </div>
  );
}
