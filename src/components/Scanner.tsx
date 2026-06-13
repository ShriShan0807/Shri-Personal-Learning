"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";

interface ScannerProps {
  onResult: (code: string) => void;
  active: boolean;
}

/** Pick the most likely rear/back camera from a device list. */
function chooseRearCamera(devices: MediaDeviceInfo[]): string | undefined {
  if (devices.length === 0) return undefined;
  const rear = devices.find((d) => /back|rear|environment/i.test(d.label));
  if (rear) return rear.deviceId;
  // On many phones the rear camera is the last entry when labels are unavailable.
  return devices[devices.length - 1].deviceId;
}

/**
 * Live camera QR scanner backed by @zxing/browser. Enumerates available video
 * inputs, defaults to the rear camera, and lets the user switch between feeds.
 * Designed to run over HTTPS / localhost where getUserMedia is permitted.
 */
export default function Scanner({ onResult, active }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  // Step 1: when activated, request permission and enumerate cameras.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("unsupported");
        }
        // Requesting a stream first unlocks device labels for enumeration.
        const probe = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
        probe.getTracks().forEach((t) => t.stop());

        const list = (await navigator.mediaDevices.enumerateDevices()).filter(
          (d) => d.kind === "videoinput"
        );
        if (cancelled) return;

        setDevices(list);
        setDeviceId((current) => current ?? chooseRearCamera(list));
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(describeError(err));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [active]);

  // Step 2: (re)start decoding whenever the active camera changes.
  useEffect(() => {
    if (!active || !deviceId) return;
    let cancelled = false;
    setStarting(true);
    const reader = new BrowserMultiFormatReader();

    (async () => {
      try {
        const controls = await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current!,
          (result) => {
            if (!result) return;
            const text = result.getText();
            const now = Date.now();
            // Debounce duplicate reads of the same code within 2.5s.
            if (text === lastRef.current.code && now - lastRef.current.at < 2500) return;
            lastRef.current = { code: text, at: now };
            onResultRef.current(text);
          }
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setError(null);
      } catch (err) {
        if (!cancelled) setError(describeError(err));
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [active, deviceId]);

  const switchCamera = useCallback(() => {
    if (devices.length < 2) return;
    setDeviceId((current) => {
      const idx = devices.findIndex((d) => d.deviceId === current);
      const next = devices[(idx + 1) % devices.length];
      return next.deviceId;
    });
  }, [devices]);

  return (
    <div className="space-y-2">
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted playsInline />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-2/3 w-2/3 rounded-xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
        </div>
        {starting && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
            Starting camera…
          </div>
        )}
      </div>

      {devices.length > 1 && (
        <div className="flex items-center gap-2">
          <select
            className="input !py-1.5 text-sm"
            value={deviceId ?? ""}
            onChange={(e) => setDeviceId(e.target.value)}
            aria-label="Select camera"
          >
            {devices.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-secondary whitespace-nowrap !px-3 !py-1.5 text-sm"
            onClick={switchCamera}
          >
            🔄 Switch
          </button>
        </div>
      )}

      {error && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{error}</p>}
    </div>
  );
}

function describeError(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === "NotAllowedError") {
      return "Camera permission denied. Allow camera access in your browser, or enter the code manually.";
    }
    if (err.name === "NotFoundError" || err.name === "OverconstrainedError") {
      return "No suitable camera found. Try another camera, or enter the code manually.";
    }
    if (err.name === "NotReadableError") {
      return "The camera is in use by another app. Close it and try again, or enter the code manually.";
    }
    if (err.message === "unsupported") {
      return "Camera access requires HTTPS (or localhost). You can enter the code manually instead.";
    }
  }
  return "Unable to start the camera. You can enter the code manually instead.";
}
