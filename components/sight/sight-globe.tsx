"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  geoOrthographic,
  geoPath,
  geoGraticule10,
  geoInterpolate,
} from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from "geojson";
import type { Topology } from "topojson-specification";
import { Plus, Minus, Locate } from "lucide-react";

export interface AccountMarker {
  id: string;
  location: [number, number];
  label: string;
  city: string;
  balance: number;
  currency: string;
  status: "healthy" | "warning" | "critical";
}

export interface TransferArc {
  id: string;
  from: [number, number];
  to: [number, number];
  channel: "SWIFT" | "SEPA" | "VISA" | "MASTERCARD";
  amount: number;
  currency: string;
  recommended?: boolean;
}

interface SightGlobeProps {
  markers: AccountMarker[];
  arcs: TransferArc[];
  className?: string;
  speed?: number;
}

const STATUS_COLOR: Record<AccountMarker["status"], string> = {
  healthy: "#0A0A0A",
  warning: "#F59E0B",
  critical: "#DC2626",
};

const STATUS_RANK: Record<AccountMarker["status"], number> = {
  healthy: 0,
  warning: 1,
  critical: 2,
};

const MIN_SCALE = 0.7;
const MAX_SCALE = 6;
const ZOOM_STEP = 1.25;
const IDLE_RESUME_MS = 4000;

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function shortestAngle(from: number, to: number): number {
  return (((to - from) % 360) + 540) % 360 - 180;
}

interface MarkerCluster {
  id: string;
  location: [number, number];
  city: string;
  primaryCurrency: string;
  count: number;
  status: AccountMarker["status"];
}

function clusterMarkers(markers: AccountMarker[]): MarkerCluster[] {
  const groups = new Map<string, AccountMarker[]>();
  for (const m of markers) {
    const key = `${m.location[0].toFixed(1)}_${m.location[1].toFixed(1)}`;
    const arr = groups.get(key);
    if (arr) arr.push(m);
    else groups.set(key, [m]);
  }
  return Array.from(groups.entries()).map(([key, group]) => {
    const worst = group.reduce((acc, m) =>
      STATUS_RANK[m.status] > STATUS_RANK[acc.status] ? m : acc,
    );
    const counts = new Map<string, number>();
    for (const m of group) counts.set(m.currency, (counts.get(m.currency) ?? 0) + 1);
    const primary = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
    return {
      id: `c_${key.replace(/[^a-z0-9_]/gi, "")}`,
      location: worst.location,
      city: worst.city,
      primaryCurrency: primary,
      count: group.length,
      status: worst.status,
    };
  });
}

function dedupeArcs(arcs: TransferArc[]): TransferArc[] {
  const seen = new Map<string, TransferArc>();
  for (const a of arcs) {
    const key = `${a.from[0].toFixed(1)}_${a.from[1].toFixed(1)}__${a.to[0].toFixed(1)}_${a.to[1].toFixed(1)}`;
    const prior = seen.get(key);
    if (!prior || a.amount > prior.amount) seen.set(key, a);
  }
  return Array.from(seen.values());
}

let cachedLand: Feature<Geometry, GeoJsonProperties> | null = null;
let landPromise: Promise<Feature<Geometry, GeoJsonProperties>> | null = null;

function loadLand(): Promise<Feature<Geometry, GeoJsonProperties>> {
  if (cachedLand) return Promise.resolve(cachedLand);
  if (landPromise) return landPromise;
  landPromise = fetch("/world-land-110m.json")
    .then((r) => r.json() as Promise<Topology>)
    .then((topo) => {
      const land = feature(topo, topo.objects.land) as
        | Feature<Geometry, GeoJsonProperties>
        | FeatureCollection<Geometry, GeoJsonProperties>;
      const single: Feature<Geometry, GeoJsonProperties> =
        "features" in land ? land.features[0] : land;
      cachedLand = single;
      return single;
    });
  return landPromise;
}

function lngLatVisible(
  lng: number,
  lat: number,
  rotLambda: number,
  rotPhi: number,
): boolean {
  const lambda = (lng + rotLambda) * (Math.PI / 180);
  const phi = lat * (Math.PI / 180);
  const phi0 = -rotPhi * (Math.PI / 180);
  const cosC =
    Math.sin(phi0) * Math.sin(phi) +
    Math.cos(phi0) * Math.cos(phi) * Math.cos(lambda);
  return cosC > 0.02;
}

export function SightGlobe({
  markers,
  arcs,
  className = "",
  speed = 0.16,
}: SightGlobeProps) {
  const clusters = useMemo(() => clusterMarkers(markers), [markers]);
  const dedupedArcs = useMemo(() => dedupeArcs(arcs), [arcs]);

  const [landReady, setLandReady] = useState(!!cachedLand);
  const [zoomDisplay, setZoomDisplay] = useState(100);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const markerElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const clusterStatusRef = useRef<Map<string, AccountMarker["status"]>>(new Map());
  const arcSeenAtRef = useRef<Map<string, number>>(new Map());

  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });

  const rotRef = useRef<[number, number]>([20, -25]);
  const targetRotRef = useRef<[number, number] | null>(null);
  const scaleRef = useRef(1);
  const targetScaleRef = useRef(1);

  const isInteractingRef = useRef(false);
  const pointerRef = useRef<{
    x: number;
    y: number;
    lambda: number;
    phi: number;
    moved: boolean;
  } | null>(null);
  const lastInteractRef = useRef(0);

  useEffect(() => {
    if (!cachedLand) loadLand().then(() => setLandReady(true));
  }, []);

  useEffect(() => {
    const map = new Map<string, AccountMarker["status"]>();
    for (const c of clusters) map.set(c.id, c.status);
    clusterStatusRef.current = map;
  }, [clusters]);

  useEffect(() => {
    const now = Date.now();
    const seen = arcSeenAtRef.current;
    const currentIds = new Set<string>();
    for (const a of dedupedArcs) {
      currentIds.add(a.id);
      if (!seen.has(a.id)) seen.set(a.id, now);
    }
    for (const id of Array.from(seen.keys())) {
      if (!currentIds.has(id)) seen.delete(id);
    }
  }, [dedupedArcs]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    function resize() {
      const r = wrap!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.floor(r.width));
      const h = Math.max(1, Math.floor(r.height));
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      sizeRef.current = { width: w, height: h, dpr };
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let raf = 0;
    let lastDisplayedZoom = 100;

    function render() {
      const { width, height, dpr } = sizeRef.current;
      if (width === 0 || height === 0) {
        raf = requestAnimationFrame(render);
        return;
      }

      const now = Date.now();
      const sinceInteract = now - lastInteractRef.current;
      const idle = !isInteractingRef.current && sinceInteract > IDLE_RESUME_MS;

      const ds = targetScaleRef.current - scaleRef.current;
      if (Math.abs(ds) > 0.001) {
        scaleRef.current += ds * 0.2;
      } else if (scaleRef.current !== targetScaleRef.current) {
        scaleRef.current = targetScaleRef.current;
      }

      const newDisplayZoom = Math.round(scaleRef.current * 100);
      if (newDisplayZoom !== lastDisplayedZoom) {
        lastDisplayedZoom = newDisplayZoom;
        setZoomDisplay(newDisplayZoom);
      }

      if (targetRotRef.current) {
        const [tl, tp] = targetRotRef.current;
        const [cl, cp] = rotRef.current;
        const dl = shortestAngle(cl, tl);
        const dp = tp - cp;
        if (Math.abs(dl) < 0.3 && Math.abs(dp) < 0.3) {
          rotRef.current = [tl, tp];
          targetRotRef.current = null;
        } else {
          rotRef.current = [cl + dl * 0.18, cp + dp * 0.18];
        }
      } else if (idle && scaleRef.current <= 1.2) {
        rotRef.current = [rotRef.current[0] + speed, rotRef.current[1]];
      }

      drawGlobe(ctx!, width, height, dpr);
      updateMarkers(width, height);

      raf = requestAnimationFrame(render);
    }

    function drawGlobe(
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      dpr: number,
    ) {
      const r = (Math.min(width, height) / 2) * 0.96 * scaleRef.current;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const proj = geoOrthographic()
        .scale(r)
        .translate([width / 2, height / 2])
        .rotate([rotRef.current[0], rotRef.current[1], 0])
        .clipAngle(90);
      const path = geoPath(proj, ctx);

      const cx = width / 2;
      const cy = height / 2;
      const grad = ctx.createRadialGradient(
        cx - r * 0.3,
        cy - r * 0.4,
        r * 0.1,
        cx,
        cy,
        r,
      );
      grad.addColorStop(0, "#FFFFFF");
      grad.addColorStop(1, "#F4F4F5");

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();

      ctx.beginPath();
      path(geoGraticule10());
      ctx.strokeStyle = "rgba(10,10,10,0.05)";
      ctx.lineWidth = 0.5;
      ctx.stroke();

      if (cachedLand) {
        ctx.beginPath();
        path(cachedLand);
        ctx.fillStyle = "#18181B";
        ctx.fill();
      }

      ctx.lineCap = "round";
      const traceMs = 800;
      const nowTs = Date.now();
      for (const arc of dedupedArcs) {
        const from: [number, number] = [arc.from[1], arc.from[0]];
        const to: [number, number] = [arc.to[1], arc.to[0]];
        const interp = geoInterpolate(from, to);
        const samples = 48;
        const fullCoords = new Array(samples + 1);
        for (let i = 0; i <= samples; i++) {
          fullCoords[i] = interp(i / samples);
        }
        const seenAt = arcSeenAtRef.current.get(arc.id) ?? nowTs;
        const age = nowTs - seenAt;
        const progress = Math.min(1, age / traceMs);
        const drawCount = Math.max(2, Math.ceil((samples + 1) * progress));
        const coords = fullCoords.slice(0, drawCount);

        if (arc.recommended) {
          ctx.lineWidth = 1.3;
          ctx.strokeStyle = "rgba(37,99,235,0.72)";
          ctx.setLineDash([5, 4]);
          ctx.lineDashOffset = -((nowTs / 60) % 18);
        } else {
          ctx.lineWidth = 1.1;
          ctx.strokeStyle = "rgba(10,10,10,0.5)";
          ctx.setLineDash([]);
        }
        ctx.beginPath();
        path({ type: "LineString", coordinates: coords });
        ctx.stroke();

        if (progress < 1 && drawCount >= 2 && drawCount <= samples) {
          const headPt = proj(coords[coords.length - 1]);
          if (headPt) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(headPt[0], headPt[1], 2.4, 0, Math.PI * 2);
            ctx.fillStyle = arc.recommended
              ? "rgba(37,99,235,0.95)"
              : "rgba(10,10,10,0.85)";
            ctx.fill();
            ctx.restore();
          }
        }
      }
      ctx.setLineDash([]);

      ctx.restore();

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(10,10,10,0.16)";
      ctx.lineWidth = 0.8;
      ctx.stroke();

      ctx.restore();
    }

    function updateMarkers(width: number, height: number) {
      const r = (Math.min(width, height) / 2) * 0.96 * scaleRef.current;
      const proj = geoOrthographic()
        .scale(r)
        .translate([width / 2, height / 2])
        .rotate([rotRef.current[0], rotRef.current[1], 0])
        .clipAngle(90);

      const pulse = 0.5 + 0.5 * Math.sin((Date.now() / 800) * Math.PI * 2);

      for (const cluster of clusters) {
        const el = markerElsRef.current.get(cluster.id);
        if (!el) continue;
        const [lng, lat] = [cluster.location[1], cluster.location[0]];
        const visible = lngLatVisible(
          lng,
          lat,
          rotRef.current[0],
          rotRef.current[1],
        );
        if (!visible) {
          if (el.style.opacity !== "0") {
            el.style.opacity = "0";
            el.style.pointerEvents = "none";
          }
          continue;
        }
        const pt = proj([lng, lat]);
        if (!pt) continue;
        el.style.transform = `translate3d(${pt[0]}px, ${pt[1]}px, 0)`;
        if (el.style.opacity !== "1") {
          el.style.opacity = "1";
          el.style.pointerEvents = "auto";
        }

        const status = clusterStatusRef.current.get(cluster.id) ?? cluster.status;
        const btn = el.querySelector("button") as HTMLButtonElement | null;
        if (btn) {
          if (status === "critical") {
            const haloAlpha = 0.22 + pulse * 0.32;
            const haloSize = 4 + pulse * 10;
            const dotScale = 1 + pulse * 0.5;
            btn.style.boxShadow = `0 0 0 ${haloSize}px rgba(220,38,38,${haloAlpha}), 0 1px 3px rgba(0,0,0,0.25)`;
            btn.style.background = "#DC2626";
            btn.style.transform = `scale(${dotScale})`;
          } else if (status === "warning") {
            btn.style.boxShadow = "0 0 0 4px rgba(245,158,11,0.18), 0 1px 3px rgba(0,0,0,0.18)";
            btn.style.background = "#F59E0B";
            btn.style.transform = "scale(1)";
          } else {
            btn.style.boxShadow = "0 0 0 3px rgba(10,10,10,0.10), 0 1px 3px rgba(0,0,0,0.15)";
            btn.style.background = "#0A0A0A";
            btn.style.transform = "scale(1)";
          }
        }
      }
    }

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [clusters, dedupedArcs, speed, landReady]);

  const markInteraction = useCallback(() => {
    lastInteractRef.current = Date.now();
  }, []);

  const setScaleClamped = useCallback(
    (next: number) => {
      targetScaleRef.current = clamp(next, MIN_SCALE, MAX_SCALE);
      markInteraction();
    },
    [markInteraction],
  );

  const zoomIn = useCallback(() => setScaleClamped(targetScaleRef.current * ZOOM_STEP), [setScaleClamped]);
  const zoomOut = useCallback(() => setScaleClamped(targetScaleRef.current / ZOOM_STEP), [setScaleClamped]);
  const resetView = useCallback(() => {
    targetScaleRef.current = 1;
    targetRotRef.current = [20, -25];
    lastInteractRef.current = 0;
  }, []);

  const focusOn = useCallback((lng: number, lat: number) => {
    targetRotRef.current = [-lng, -lat];
    targetScaleRef.current = Math.max(targetScaleRef.current, 1.7);
    markInteraction();
  }, [markInteraction]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      isInteractingRef.current = true;
      markInteraction();
      targetRotRef.current = null;
      pointerRef.current = {
        x: e.clientX,
        y: e.clientY,
        lambda: rotRef.current[0],
        phi: rotRef.current[1],
        moved: false,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [markInteraction],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const p = pointerRef.current;
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) p.moved = true;
      const sensitivity = 0.35 / scaleRef.current;
      const nextLambda = p.lambda + dx * sensitivity;
      const nextPhi = clamp(p.phi + dy * sensitivity, -75, 75);
      rotRef.current = [nextLambda, nextPhi];
      markInteraction();
    },
    [markInteraction],
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    pointerRef.current = null;
    isInteractingRef.current = false;
    lastInteractRef.current = Date.now();
    const el = e.currentTarget as HTMLElement;
    if (el.hasPointerCapture?.(e.pointerId)) {
      el.releasePointerCapture(e.pointerId);
    }
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    function onWheel(ev: WheelEvent) {
      ev.preventDefault();
      const factor = ev.deltaY < 0 ? 1.1 : 1 / 1.1;
      setScaleClamped(targetScaleRef.current * factor);
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setScaleClamped]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomIn();
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        zoomOut();
      } else if (e.key === "0") {
        e.preventDefault();
        resetView();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomIn, zoomOut, resetView]);

  return (
    <div className={`relative aspect-square select-none ${className}`}>
      <div
        ref={wrapRef}
        className="relative h-full w-full"
        style={{ touchAction: "none", cursor: "grab" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <canvas ref={canvasRef} className="absolute inset-0" />
        <div
          ref={overlayRef}
          className="pointer-events-none absolute inset-0"
        >
          {clusters.map((c) => (
            <div
              key={c.id}
              ref={(el) => {
                if (el) markerElsRef.current.set(c.id, el);
                else markerElsRef.current.delete(c.id);
              }}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: 0,
                height: 0,
                opacity: 0,
                pointerEvents: "none",
                transform: "translate3d(-9999px, -9999px, 0)",
                transition: "opacity 0.18s ease",
                willChange: "transform",
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  if (pointerRef.current?.moved) return;
                  e.stopPropagation();
                  focusOn(c.location[1], c.location[0]);
                }}
                aria-label={`Focus on ${c.city}`}
                style={{
                  position: "absolute",
                  left: -7,
                  top: -7,
                  width: 14,
                  height: 14,
                  padding: 0,
                  margin: 0,
                  border: "2px solid #FFFFFF",
                  borderRadius: "50%",
                  background: STATUS_COLOR[c.status],
                  cursor: "pointer",
                  boxShadow:
                    c.status === "critical"
                      ? "0 0 0 4px rgba(220,38,38,0.18), 0 1px 3px rgba(0,0,0,0.25)"
                      : c.status === "warning"
                        ? "0 0 0 4px rgba(245,158,11,0.18), 0 1px 3px rgba(0,0,0,0.18)"
                        : "0 0 0 3px rgba(10,10,10,0.10), 0 1px 3px rgba(0,0,0,0.15)",
                  pointerEvents: "auto",
                }}
              />
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  top: 12,
                  transform: "translateX(-50%)",
                  fontFamily: "var(--font-geist-mono), monospace",
                  fontSize: "0.6rem",
                  lineHeight: 1.2,
                  color: "#0A0A0A",
                  background: "#FFFFFF",
                  padding: "3px 7px",
                  borderRadius: 4,
                  letterSpacing: "0.06em",
                  whiteSpace: "nowrap",
                  boxShadow:
                    "0 1px 2px rgba(0,0,0,0.08), 0 4px 12px -4px rgba(0,0,0,0.12)",
                  border: "1px solid rgba(0,0,0,0.06)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  pointerEvents: "none",
                }}
              >
                <span style={{ fontWeight: 600 }}>{c.primaryCurrency}</span>
                <span style={{ color: "#71717A", fontSize: "0.55rem" }}>
                  {c.city}
                </span>
                {c.count > 1 && (
                  <span
                    style={{
                      background: "#0A0A0A",
                      color: "#FFFFFF",
                      padding: "1px 4px",
                      borderRadius: 3,
                      fontSize: "0.5rem",
                      lineHeight: 1.1,
                    }}
                  >
                    {c.count}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="pointer-events-auto absolute right-3 top-3 z-20 flex flex-col items-stretch overflow-hidden rounded-lg border border-zinc-200 bg-white/95 shadow-sm backdrop-blur-sm">
        <ZoomButton aria-label="Zoom in" onClick={zoomIn} disabled={zoomDisplay >= MAX_SCALE * 100}>
          <Plus className="h-3.5 w-3.5" strokeWidth={1.6} />
        </ZoomButton>
        <div className="border-t border-zinc-200/80 px-2 py-1.5 text-center font-mono text-[10px] tabular-nums text-zinc-700">
          {zoomDisplay}%
        </div>
        <ZoomButton aria-label="Zoom out" onClick={zoomOut} disabled={zoomDisplay <= MIN_SCALE * 100} border>
          <Minus className="h-3.5 w-3.5" strokeWidth={1.6} />
        </ZoomButton>
        <ZoomButton aria-label="Reset view" onClick={resetView} border>
          <Locate className="h-3.5 w-3.5" strokeWidth={1.6} />
        </ZoomButton>
      </div>
    </div>
  );
}

interface ZoomButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  "aria-label": string;
  disabled?: boolean;
  border?: boolean;
}

function ZoomButton({
  children,
  onClick,
  "aria-label": ariaLabel,
  disabled,
  border,
}: ZoomButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={disabled}
      className={`flex h-7 w-9 items-center justify-center text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:text-zinc-300 disabled:hover:bg-transparent ${
        border ? "border-t border-zinc-200/80" : ""
      }`}
    >
      {children}
    </button>
  );
}
