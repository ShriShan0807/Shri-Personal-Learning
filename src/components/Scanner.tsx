"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";

interface ScannerProps {
  onResult: (code: string) => void;
  active: boolean;
}

/**
 * Live camera QR scanner backed by @zxing/browser. Requests the rear camera
 * (facingMode "environment") and streams decoded text to `onResult`. Designed
 * to run over HTTPS / localhost where getUserMedia is permitted.
 */
export default function Scanner({ onResult, active }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  useEffect(() => {
    if (!active) {
      controlsRef.current?.stop();
      controlsRef.current = null;
      return;
    }

    let cancelled = false;
    const reader = new BrowserMultiFormatReader();

    (async () => {
      try {
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          videoRef.current!,
          (result) => {
            if (!result) return;
            const text = result.getText();
            const now = Date.now();
            // Debounce duplicate reads of the same code within 2.5s.
            if (text === lastRef.current.code && now - lastRef.current.at < 2500) return;
            lastRef.current = { code: text, at: now };
            onResult(text);
          }
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
      } catch (err) {
        const msg =
          err instanceof Error && err.name === "NotAllowedError"
            ? "Camera permission denied. Allow camera access or enter the code manually."
            : "Unable to start the camera. You can enter the code manually instead.";
        setError(msg);
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [active, onResult]);

  return (
    <div className="space-y-2">
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-2/3 w-2/3 rounded-xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
        </div>
      </div>
      {error && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{error}</p>}
    </div>
  );
}
