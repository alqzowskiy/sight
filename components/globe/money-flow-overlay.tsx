"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  CHANNEL_STYLE,
  getDurationForChannel,
  pickRandomFlow,
  resolveFlow,
  type FlowChannel,
} from "@/lib/data/transaction-flows";
import { accountMetas } from "@/lib/data/accounts";
import {
  arcControlPoint,
  bezierPoint,
  isVisible,
  type Projector,
} from "@/lib/globe/projection";
import { formatCompact } from "@/lib/utils/format";

interface ActiveFlow {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  fromLoc: [number, number];
  toLoc: [number, number];
  amount: number;
  currency: string;
  channel: FlowChannel;
  startedAt: number;
  duration: number;
}

interface MoneyFlowOverlayProps {
  projectorRef: RefObject<Projector | null>;
  enabled: boolean;
  paused?: boolean;
  fade?: number;
  onArrival?: (accountId: string) => void;
  maxFlows?: number;
}

const FADE_OUT_MS = 600;
const ARC_FADE_IN_MS = 200;
const DEFAULT_MAX_FLOWS = 8;

function makeId(): string {
  return `flow-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

export function MoneyFlowOverlay({
  projectorRef,
  enabled,
  paused = false,
  fade = 1,
  onArrival,
  maxFlows = DEFAULT_MAX_FLOWS,
}: MoneyFlowOverlayProps) {
  const [flows, setFlows] = useState<ActiveFlow[]>([]);
  const flowsRef = useRef<ActiveFlow[]>([]);
  const arrivedRef = useRef<Set<string>>(new Set());
  const enabledRef = useRef(enabled);
  const pausedRef = useRef(paused);
  const docVisibleRef = useRef(true);
  const onArrivalRef = useRef(onArrival);

  useEffect(() => {
    onArrivalRef.current = onArrival;
  }, [onArrival]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    flowsRef.current = flows;
  }, [flows]);

  useEffect(() => {
    function onVisibility() {
      docVisibleRef.current = !document.hidden;
    }
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const accountIndex = useMemo(() => {
    const m = new Map<string, (typeof accountMetas)[number]>();
    for (const a of accountMetas) m.set(a.id, a);
    return m;
  }, []);

  useEffect(() => {
    let cancelled = false;
    function schedule() {
      if (cancelled) return;
      const delay = 2000 + Math.random() * 2000;
      window.setTimeout(() => {
        if (cancelled) return;
        spawnOne();
        schedule();
      }, delay);
    }
    function spawnOne() {
      if (!enabledRef.current) return;
      if (pausedRef.current) return;
      if (!docVisibleRef.current) return;
      if (flowsRef.current.length >= maxFlows) return;
      const flowDef = pickRandomFlow();
      const fromAcc = accountIndex.get(flowDef.from);
      const toAcc = accountIndex.get(flowDef.to);
      if (!fromAcc || !toAcc) return;
      const resolved = resolveFlow(flowDef);
      const flow: ActiveFlow = {
        id: makeId(),
        fromAccountId: fromAcc.id,
        toAccountId: toAcc.id,
        fromLoc: fromAcc.location,
        toLoc: toAcc.location,
        amount: resolved.amount,
        currency: fromAcc.currency,
        channel: resolved.channel,
        startedAt: performance.now(),
        duration: getDurationForChannel(resolved.channel),
      };
      setFlows((prev) => [...prev, flow]);
      const total = flow.duration + FADE_OUT_MS + 50;
      window.setTimeout(() => {
        if (cancelled) return;
        setFlows((prev) => prev.filter((f) => f.id !== flow.id));
        arrivedRef.current.delete(flow.id);
      }, total);
    }
    schedule();
    return () => {
      cancelled = true;
    };
  }, [accountIndex, maxFlows]);

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      style={{
        willChange: "transform",
        transform: "translateZ(0)",
        opacity: fade,
        transition: "opacity 0.35s ease",
      }}
    >
      {flows.map((flow) => (
        <FlowParticle
          key={flow.id}
          flow={flow}
          projectorRef={projectorRef}
          paused={paused}
          onArrival={() => {
            if (arrivedRef.current.has(flow.id)) return;
            arrivedRef.current.add(flow.id);
            onArrivalRef.current?.(flow.toAccountId);
          }}
        />
      ))}
    </svg>
  );
}

interface FlowParticleProps {
  flow: ActiveFlow;
  projectorRef: RefObject<Projector | null>;
  paused: boolean;
  onArrival: () => void;
}

function FlowParticle({ flow, projectorRef, paused, onArrival }: FlowParticleProps) {
  const groupRef = useRef<SVGGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const trailRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const glowRef = useRef<SVGCircleElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const onArrivalRef = useRef(onArrival);
  const pauseOffsetRef = useRef(0);
  const pauseStartedAtRef = useRef<number | null>(null);

  const style = CHANNEL_STYLE[flow.channel];

  useEffect(() => {
    onArrivalRef.current = onArrival;
  }, [onArrival]);

  useEffect(() => {
    if (paused) {
      if (pauseStartedAtRef.current === null) {
        pauseStartedAtRef.current = performance.now();
      }
    } else if (pauseStartedAtRef.current !== null) {
      pauseOffsetRef.current += performance.now() - pauseStartedAtRef.current;
      pauseStartedAtRef.current = null;
    }
  }, [paused]);

  useEffect(() => {
    let raf = 0;

    function frame() {
      const projector = projectorRef.current;
      const group = groupRef.current;
      const path = pathRef.current;
      const dot = dotRef.current;
      const glow = glowRef.current;
      const label = labelRef.current;
      const trail = trailRef.current;

      if (!projector || !group || !path || !dot || !glow) {
        raf = requestAnimationFrame(frame);
        return;
      }

      const now = performance.now();
      const elapsedPaused =
        pauseStartedAtRef.current !== null
          ? pauseOffsetRef.current + (now - pauseStartedAtRef.current)
          : pauseOffsetRef.current;
      const elapsed = Math.max(0, now - flow.startedAt - elapsedPaused);

      const fromPt = projector.project(flow.fromLoc[0], flow.fromLoc[1]);
      const toPt = projector.project(flow.toLoc[0], flow.toLoc[1]);

      const fromVisible =
        fromPt &&
        isVisible(
          flow.fromLoc[1],
          flow.fromLoc[0],
          projector.state.rotation[0],
          projector.state.rotation[1],
        );
      const toVisible =
        toPt &&
        isVisible(
          flow.toLoc[1],
          flow.toLoc[0],
          projector.state.rotation[0],
          projector.state.rotation[1],
        );

      if (!fromPt || !toPt || (!fromVisible && !toVisible)) {
        group.style.opacity = "0";
        raf = requestAnimationFrame(frame);
        return;
      }

      const control = arcControlPoint(
        { x: fromPt.x, y: fromPt.y },
        { x: toPt.x, y: toPt.y },
        0.35,
      );

      const t = Math.min(1, elapsed / flow.duration);
      const eased = easeOutCubic(t);
      const head = bezierPoint(
        { x: fromPt.x, y: fromPt.y },
        control,
        { x: toPt.x, y: toPt.y },
        eased,
      );

      const fullPath = `M ${fromPt.x.toFixed(1)} ${fromPt.y.toFixed(1)} Q ${control.x.toFixed(1)} ${control.y.toFixed(1)} ${toPt.x.toFixed(1)} ${toPt.y.toFixed(1)}`;
      path.setAttribute("d", fullPath);

      const samples = 18;
      const trailStart = Math.max(0, eased - 0.18);
      const pts: string[] = [];
      for (let i = 0; i <= samples; i++) {
        const ti = trailStart + ((eased - trailStart) * i) / samples;
        const p = bezierPoint(
          { x: fromPt.x, y: fromPt.y },
          control,
          { x: toPt.x, y: toPt.y },
          ti,
        );
        pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
      }
      if (trail) {
        trail.setAttribute(
          "d",
          pts.length > 0 ? `M ${pts.join(" L ")}` : "",
        );
      }

      const fadeIn = Math.min(1, elapsed / ARC_FADE_IN_MS);
      const afterArrival = elapsed - flow.duration;
      const fadeOut =
        afterArrival > 0 ? Math.max(0, 1 - afterArrival / FADE_OUT_MS) : 1;
      const arcAlpha = fadeIn * fadeOut;

      path.setAttribute("opacity", (arcAlpha * 0.55).toFixed(3));
      if (trail) trail.setAttribute("opacity", (arcAlpha * 0.9).toFixed(3));

      const dotAlpha = fadeIn * (t < 1 ? 1 : Math.max(0, 1 - afterArrival / 250));
      dot.setAttribute("cx", head.x.toFixed(1));
      dot.setAttribute("cy", head.y.toFixed(1));
      dot.setAttribute("opacity", dotAlpha.toFixed(3));
      glow.setAttribute("cx", head.x.toFixed(1));
      glow.setAttribute("cy", head.y.toFixed(1));
      glow.setAttribute("opacity", (dotAlpha * 0.55).toFixed(3));

      if (label) {
        const labelAlpha =
          fadeIn *
          (t < 0.9 ? 1 : Math.max(0, 1 - (t - 0.9) / 0.1)) *
          (afterArrival > 0 ? Math.max(0, 1 - afterArrival / 200) : 1);
        label.style.transform = `translate3d(${head.x.toFixed(1)}px, ${(head.y - 18).toFixed(1)}px, 0)`;
        label.style.opacity = labelAlpha.toFixed(3);
      }

      group.style.opacity = "1";

      if (t >= 1 && afterArrival < 30) {
        onArrivalRef.current();
      }

      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [flow, projectorRef]);

  return (
    <>
      <g ref={groupRef} style={{ opacity: 0 }}>
        <path
          ref={pathRef}
          fill="none"
          stroke={style.color}
          strokeWidth={style.width * 0.6}
          strokeLinecap="round"
          opacity="0"
          strokeDasharray={style.dashed ? "3 3" : undefined}
        />
        <path
          ref={trailRef}
          fill="none"
          stroke={style.color}
          strokeWidth={style.width}
          strokeLinecap="round"
          opacity="0"
          strokeDasharray={style.dashed ? "3 3" : undefined}
        />
        <circle
          ref={glowRef}
          r={6}
          fill={style.glowColor}
          opacity="0"
        />
        <circle
          ref={dotRef}
          r={2.6}
          fill={style.color}
          opacity="0"
        />
      </g>
      <foreignObject x={0} y={0} width="1" height="1" style={{ overflow: "visible" }}>
        <div
          ref={labelRef}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            transform: "translate3d(-9999px,-9999px,0)",
            opacity: 0,
            pointerEvents: "none",
            willChange: "transform, opacity",
          }}
        >
          <div
            style={{
              transform: "translateX(-50%)",
              fontFamily: "var(--font-geist-mono), monospace",
              fontSize: "9px",
              fontWeight: 500,
              letterSpacing: "0.04em",
              padding: "2px 5px",
              borderRadius: 3,
              background: "rgba(10,10,10,0.88)",
              color: "#FFFFFF",
              whiteSpace: "nowrap",
              boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
            }}
          >
            {formatCompact(flow.amount, flow.currency)}
            <span style={{ marginLeft: 4, opacity: 0.6 }}>
              {style.shortLabel}
            </span>
          </div>
        </div>
      </foreignObject>
    </>
  );
}
