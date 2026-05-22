"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
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
import { MoneyFlowOverlay } from "@/components/globe/money-flow-overlay";
import { ConnectionWebOverlay } from "@/components/globe/connection-web-overlay";
import { GlobeHoverCard } from "@/components/globe/globe-hover-card";
import { isVisible, type Projector } from "@/lib/globe/projection";
import { useTimeStore } from "@/lib/store/time-store";

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
  onMarkerClick?: (info: { clusterId: string; location: [number, number] }) => void;
  /** Pre-computed connection web edges to draw on top of markers. */
  connectionEdges?: import("@/lib/globe/connection-web").ConnectionEdge[];
  /** Max edge volume from the same web (for line-width normalisation). */
  connectionMaxAmount?: number;
  /** Toggle the whole web layer. */
  connectionsVisible?: boolean;
  /** When set, dim non-incident edges to highlight one account's network. */
  connectionFocusAccountId?: string | null;
}

export interface SightGlobeHandle {
  focusOnLocation: (
    location: [number, number],
    options?: { zoom?: boolean },
  ) => void;
  triggerPulse: (location: [number, number], kind?: "alert" | "compass") => void;
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

interface HoverState {
  clusterId: string;
  x: number;
  y: number;
}

export const SightGlobe = forwardRef<SightGlobeHandle, SightGlobeProps>(function SightGlobe({
  markers,
  arcs,
  className = "",
  speed = 0.16,
  onMarkerClick,
  connectionEdges = [],
  connectionMaxAmount = 0,
  connectionsVisible = false,
  connectionFocusAccountId = null,
}, ref) {
  const clusters = useMemo(() => clusterMarkers(markers), [markers]);
  const dedupedArcs = useMemo(() => dedupeArcs(arcs), [arcs]);

  const [landReady, setLandReady] = useState(!!cachedLand);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [eventPulses, setEventPulses] = useState<
    Array<{ id: string; lat: number; lng: number; startedAt: number; kind: "alert" | "compass" }>
  >([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const markerElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const clusterStatusRef = useRef<Map<string, AccountMarker["status"]>>(new Map());
  const arcSeenAtRef = useRef<Map<string, number>>(new Map());
  const projectorRef = useRef<Projector | null>(null);
  const arrivalPulseRef = useRef<Map<string, number>>(new Map());
  const hoverRef = useRef<HoverState | null>(null);

  const offset = useTimeStore((s) => s.currentOffset);

  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });

  const rotRef = useRef<[number, number]>([20, -25]);
  const targetRotRef = useRef<[number, number] | null>(null);
  const scaleRef = useRef(1);
  const targetScaleRef = useRef(1);

  const isInteractingRef = useRef(false);
  const pointerRef = useRef<{
    x: number;
    y: number;
    startX: number;
    startY: number;
    lambda: number;
    phi: number;
    moved: boolean;
  } | null>(null);
  const lastInteractRef = useRef(0);
  const fpsRef = useRef({ ema: 60, last: 0, frames: 0, since: 0 });

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
      setContainerSize({ width: w, height: h });
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
    let lastFpsUpdate = 0;

    function render() {
      const { width, height, dpr } = sizeRef.current;
      if (width === 0 || height === 0) {
        raf = requestAnimationFrame(render);
        return;
      }

      const now = Date.now();
      const nowPerf = performance.now();
      const fps = fpsRef.current;
      if (fps.last > 0) {
        const dt = nowPerf - fps.last;
        const inst = dt > 0 ? 1000 / dt : 60;
        fps.ema = fps.ema * 0.92 + inst * 0.08;
      }
      fps.last = nowPerf;
      if (nowPerf - lastFpsUpdate > 500) {
        lastFpsUpdate = nowPerf;
      }

      const sinceInteract = now - lastInteractRef.current;
      const idle = !isInteractingRef.current && sinceInteract > IDLE_RESUME_MS;

      const ds = targetScaleRef.current - scaleRef.current;
      if (Math.abs(ds) > 0.001) {
        scaleRef.current += ds * 0.2;
      } else if (scaleRef.current !== targetScaleRef.current) {
        scaleRef.current = targetScaleRef.current;
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

        // Halo pass — wider light stroke behind the line so the arc stays
        // visible against the dark land mass (#18181B). Cartographic
        // standard trick for lines that cross varied backgrounds.
        ctx.setLineDash([]);
        ctx.lineWidth = arc.recommended ? 3.2 : 2.6;
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.beginPath();
        path({ type: "LineString", coordinates: coords });
        ctx.stroke();

        if (arc.recommended) {
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = "rgba(37,99,235,0.95)";
          ctx.setLineDash([5, 4]);
          ctx.lineDashOffset = -((nowTs / 60) % 18);
        } else {
          ctx.lineWidth = 1.3;
          ctx.strokeStyle = "rgba(10,10,10,0.85)";
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

      projectorRef.current = {
        state: {
          rotation: [rotRef.current[0], rotRef.current[1]],
          scale: scaleRef.current,
          width,
          height,
        },
        projection: proj,
        project: (lat: number, lng: number) => {
          const visible = isVisible(
            lng,
            lat,
            rotRef.current[0],
            rotRef.current[1],
          );
          const pt = proj([lng, lat]);
          if (!pt) return null;
          return { x: pt[0], y: pt[1], visible };
        },
      };

      const pulse = 0.5 + 0.5 * Math.sin((Date.now() / 800) * Math.PI * 2);
      const nowMs = Date.now();
      const arrivalMap = arrivalPulseRef.current;
      const hoveredId = hoverRef.current?.clusterId ?? null;

      for (const cluster of clusters) {
        const el = markerElsRef.current.get(cluster.id);
        if (!el) continue;
        const [lng, lat] = [cluster.location[1], cluster.location[0]];
        const visible = isVisible(
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

        if (hoveredId === cluster.id && hoverRef.current) {
          hoverRef.current.x = pt[0];
          hoverRef.current.y = pt[1];
        }

        const arrivalAt = arrivalMap.get(cluster.id);
        let arrivalBoost = 0;
        if (arrivalAt) {
          const age = nowMs - arrivalAt;
          if (age >= 0 && age <= 400) {
            arrivalBoost = 1 - age / 400;
          } else if (age > 400) {
            arrivalMap.delete(cluster.id);
          }
        }

        const status = clusterStatusRef.current.get(cluster.id) ?? cluster.status;
        const btn = el.querySelector("button") as HTMLButtonElement | null;
        const ring = el.querySelector("[data-arrival-ring]") as HTMLElement | null;
        if (btn) {
          if (status === "critical") {
            const haloAlpha = 0.22 + pulse * 0.32;
            const haloSize = 4 + pulse * 10 + arrivalBoost * 6;
            const dotScale = 1 + pulse * 0.5 + arrivalBoost * 0.3;
            btn.style.boxShadow = `0 0 0 ${haloSize}px rgba(220,38,38,${haloAlpha}), 0 1px 3px rgba(0,0,0,0.25)`;
            btn.style.background = "#DC2626";
            btn.style.transform = `scale(${dotScale})`;
          } else if (status === "warning") {
            const haloSize = 4 + arrivalBoost * 5;
            btn.style.boxShadow = `0 0 0 ${haloSize}px rgba(245,158,11,${0.18 + arrivalBoost * 0.3}), 0 1px 3px rgba(0,0,0,0.18)`;
            btn.style.background = "#F59E0B";
            btn.style.transform = `scale(${1 + arrivalBoost * 0.25})`;
          } else {
            const haloSize = 3 + arrivalBoost * 6;
            btn.style.boxShadow = `0 0 0 ${haloSize}px rgba(37,99,235,${0.1 + arrivalBoost * 0.32}), 0 1px 3px rgba(0,0,0,0.15)`;
            btn.style.background = "#0A0A0A";
            btn.style.transform = `scale(${1 + arrivalBoost * 0.2})`;
          }
        }
        if (ring) {
          ring.style.opacity = arrivalBoost > 0 ? String(arrivalBoost * 0.7) : "0";
          const size = 14 + (1 - arrivalBoost) * 30;
          ring.style.width = `${size}px`;
          ring.style.height = `${size}px`;
          ring.style.transform = `translate(-50%, -50%)`;
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

  useImperativeHandle(
    ref,
    () => ({
      focusOnLocation: (location, options) => {
        const zoom = options?.zoom ?? true;
        targetRotRef.current = [-location[1], -location[0]];
        if (zoom) {
          targetScaleRef.current = Math.max(targetScaleRef.current, 1.7);
        }
        markInteraction();
      },
      triggerPulse: (location, kind = "alert") => {
        const pulse = {
          id: `pulse-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          lat: location[0],
          lng: location[1],
          startedAt: Date.now(),
          kind,
        };
        setEventPulses((prev) => [...prev, pulse]);
        window.setTimeout(() => {
          setEventPulses((prev) => prev.filter((p) => p.id !== pulse.id));
        }, 1500);
      },
    }),
    [markInteraction],
  );

  const hoverEnterTimerRef = useRef<number | null>(null);
  const hoverLeaveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    hoverRef.current = hover;
  }, [hover]);

  const handleMarkerEnter = useCallback(
    (clusterId: string, location: [number, number]) => {
      markInteraction();
      if (hoverLeaveTimerRef.current !== null) {
        clearTimeout(hoverLeaveTimerRef.current);
        hoverLeaveTimerRef.current = null;
      }
      if (hoverEnterTimerRef.current !== null)
        clearTimeout(hoverEnterTimerRef.current);
      hoverEnterTimerRef.current = window.setTimeout(() => {
        const proj = projectorRef.current;
        if (!proj) return;
        const projected = proj.project(location[0], location[1]);
        if (!projected || !projected.visible) return;
        setHover({ clusterId, x: projected.x, y: projected.y });
      }, 200);
    },
    [markInteraction],
  );

  const handleMarkerLeave = useCallback(() => {
    if (hoverEnterTimerRef.current !== null) {
      clearTimeout(hoverEnterTimerRef.current);
      hoverEnterTimerRef.current = null;
    }
    if (hoverLeaveTimerRef.current !== null) clearTimeout(hoverLeaveTimerRef.current);
    hoverLeaveTimerRef.current = window.setTimeout(() => {
      setHover(null);
    }, 100);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("button")) {
        // Let the marker button handle its own click.
        return;
      }
      isInteractingRef.current = true;
      setIsInteracting(true);
      markInteraction();
      targetRotRef.current = null;
      pointerRef.current = {
        x: e.clientX,
        y: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
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
      // Any pointer activity over the globe counts as interaction —
      // prevents auto-rotation from kicking in while the user is hovering.
      markInteraction();
      const p = pointerRef.current;
      if (!p) return;
      // Incremental delta from the LAST move (not from pointerdown) so the
      // rotation behaves like a continuous wheel — no rubber-band snap when
      // the cursor leaves the viewport and returns, no "stuck" feeling when
      // pitch hits the ±75° clamp.
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      const totalMoved =
        Math.abs(e.clientX - p.startX) + Math.abs(e.clientY - p.startY);
      if (totalMoved > 6) p.moved = true;
      const sensitivity = 0.35 / scaleRef.current;
      const nextLambda = rotRef.current[0] + dx * sensitivity;
      // Trackball feel: dragging UP should bring the northern hemisphere
      // toward the viewer (the surface follows the cursor). d3-geo's phi
      // rotates the opposite way from screen-Y, so we subtract dy here.
      const nextPhi = clamp(
        rotRef.current[1] - dy * sensitivity,
        -75,
        75,
      );
      rotRef.current = [nextLambda, nextPhi];
      p.x = e.clientX;
      p.y = e.clientY;
    },
    [markInteraction],
  );

  const endDrag = useCallback((pointerId?: number) => {
    pointerRef.current = null;
    isInteractingRef.current = false;
    setIsInteracting(false);
    lastInteractRef.current = Date.now();
    const el = wrapRef.current;
    if (el && pointerId !== undefined && el.hasPointerCapture?.(pointerId)) {
      el.releasePointerCapture(pointerId);
    }
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      endDrag(e.pointerId);
    },
    [endDrag],
  );

  // Safety net: if the OS swallows pointerup (window blur, tab switch, drag
  // escaping the viewport, browser bug), a global mouseup / blur still
  // clears the stuck "interacting" state so the cursor doesn't feel jammed.
  useEffect(() => {
    function release() {
      if (pointerRef.current) endDrag();
    }
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", release);
    };
  }, [endDrag]);

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
        onLostPointerCapture={handlePointerUp}
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
              <div
                data-arrival-ring
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  border: "1.5px solid rgba(37,99,235,0.8)",
                  opacity: 0,
                  pointerEvents: "none",
                  transition: "opacity 120ms ease",
                  transform: "translate(-50%, -50%)",
                  willChange: "width, height, opacity",
                }}
              />
              <button
                type="button"
                onMouseEnter={() => handleMarkerEnter(c.id, c.location)}
                onMouseLeave={handleMarkerLeave}
                onClick={(e) => {
                  if (pointerRef.current?.moved) return;
                  e.stopPropagation();
                  onMarkerClick?.({ clusterId: c.id, location: c.location });
                }}
                aria-label={`Open ${c.city} account`}
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

        <ConnectionWebOverlay
          projectorRef={projectorRef}
          edges={connectionEdges}
          maxAmount={connectionMaxAmount}
          visible={connectionsVisible}
          focusedAccountId={connectionFocusAccountId}
        />

        <MoneyFlowOverlay
          projectorRef={projectorRef}
          // Disable decorative money flows when the tenant has no accounts —
          // a "blank" workspace should not show ghost SWIFT arrivals.
          enabled={markers.length > 0}
          allowedAccountIds={
            new Set(markers.map((m) => m.id))
          }
          paused={isInteracting}
          fade={offset > 0 ? 0.6 : offset < 0 ? 0.5 : 1}
          onArrival={(accountId) => {
            const acc = markers.find((m) => m.id === accountId);
            if (!acc) return;
            const target = clusters.find(
              (c) =>
                Math.abs(c.location[0] - acc.location[0]) < 0.05 &&
                Math.abs(c.location[1] - acc.location[1]) < 0.05,
            );
            if (target) arrivalPulseRef.current.set(target.id, Date.now());
          }}
        />

        <EventPulseLayer pulses={eventPulses} projectorRef={projectorRef} />

        {hover && (() => {
          const cluster = clusters.find((c) => c.id === hover.clusterId);
          if (!cluster) return null;
          return (
            <GlobeHoverCard
              location={cluster.location}
              x={hover.x}
              y={hover.y}
              containerWidth={containerSize.width}
              containerHeight={containerSize.height}
            />
          );
        })()}
      </div>

      {offset !== 0 && (
        <div className="pointer-events-auto absolute left-3 top-3 z-20 rounded-md border border-zinc-200 bg-white/95 px-2 py-1 font-mono text-[9.5px] uppercase tracking-[0.1em] text-zinc-700 backdrop-blur-sm">
          <span
            className="mr-1.5 inline-block h-1.5 w-1.5 rotate-45 align-middle"
            style={{
              background: offset > 0 ? "#2563EB" : "#71717A",
              boxShadow: offset > 0 ? "0 0 4px rgba(37,99,235,0.5)" : "none",
            }}
          />
          {offset > 0 ? "Forecast" : "History"}
          <span className="ml-1 text-zinc-400">
            {offset > 0 ? "+" : "-"}
            {Math.abs(offset)}d
          </span>
        </div>
      )}
    </div>
  );
});

interface EventPulseLayerProps {
  pulses: Array<{
    id: string;
    lat: number;
    lng: number;
    startedAt: number;
    kind: "alert" | "compass";
  }>;
  projectorRef: React.RefObject<Projector | null>;
}

function EventPulseLayer({ pulses, projectorRef }: EventPulseLayerProps) {
  return (
    <svg className="pointer-events-none absolute inset-0">
      {pulses.map((p) => (
        <EventPulseRing key={p.id} pulse={p} projectorRef={projectorRef} />
      ))}
    </svg>
  );
}

interface EventPulseRingProps {
  pulse: {
    id: string;
    lat: number;
    lng: number;
    startedAt: number;
    kind: "alert" | "compass";
  };
  projectorRef: React.RefObject<Projector | null>;
}

function EventPulseRing({ pulse, projectorRef }: EventPulseRingProps) {
  const outerRef = useRef<SVGCircleElement>(null);
  const innerRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    let raf = 0;
    function frame() {
      const projector = projectorRef.current;
      const outer = outerRef.current;
      const inner = innerRef.current;
      if (!projector || !outer || !inner) {
        raf = requestAnimationFrame(frame);
        return;
      }
      const pt = projector.project(pulse.lat, pulse.lng);
      const now = Date.now();
      const age = now - pulse.startedAt;
      const t = Math.min(1.4, age / 1400);
      if (!pt || !pt.visible || age < 0) {
        outer.setAttribute("opacity", "0");
        inner.setAttribute("opacity", "0");
        raf = requestAnimationFrame(frame);
        return;
      }
      const r = 4 + t * 60;
      const alpha = Math.max(0, 1 - t);
      outer.setAttribute("cx", pt.x.toFixed(1));
      outer.setAttribute("cy", pt.y.toFixed(1));
      outer.setAttribute("r", r.toFixed(1));
      outer.setAttribute("opacity", (alpha * 0.7).toFixed(3));
      inner.setAttribute("cx", pt.x.toFixed(1));
      inner.setAttribute("cy", pt.y.toFixed(1));
      inner.setAttribute("r", (r * 0.55).toFixed(1));
      inner.setAttribute("opacity", (alpha * 0.45).toFixed(3));
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [pulse, projectorRef]);

  const color = pulse.kind === "alert" ? "rgb(220,38,38)" : "rgb(37,99,235)";
  return (
    <g>
      <circle ref={outerRef} fill="none" stroke={color} strokeWidth={1.4} opacity="0" />
      <circle ref={innerRef} fill="none" stroke={color} strokeWidth={1} opacity="0" />
    </g>
  );
}

