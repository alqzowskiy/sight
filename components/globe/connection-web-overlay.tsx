"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  CHANNEL_COLOR,
  edgeWeight,
  type ConnectionEdge,
} from "@/lib/globe/connection-web";
import {
  arcControlPoint,
  bezierPoint,
  type Projector,
} from "@/lib/globe/projection";

interface ConnectionWebOverlayProps {
  projectorRef: RefObject<Projector | null>;
  edges: ConnectionEdge[];
  maxAmount: number;
  /** Optional account id to highlight; non-incident edges dim out. */
  focusedAccountId?: string | null;
  /** Hide everything when toggled off. */
  visible: boolean;
}

const ARC_SAMPLES = 40;
const FRAME_INTERVAL_MS = 1000 / 30; // 30 fps is plenty for static arcs

/**
 * Renders the connection web as bezier arcs on top of the globe. Re-projects
 * on every frame because the globe rotates and zooms; uses requestAnimationFrame
 * throttled to ~30fps to keep CPU low.
 */
export function ConnectionWebOverlay({
  projectorRef,
  edges,
  maxAmount,
  focusedAccountId,
  visible,
}: ConnectionWebOverlayProps) {
  const [, force] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef(0);

  // Drive a 30fps rerender loop so the arcs follow the globe as it rotates.
  // We intentionally don't useFrame from a 3D lib — this overlay sits on a
  // sibling absolute-positioned SVG above the canvas.
  useEffect(() => {
    if (!visible) return;
    function tick(now: number) {
      if (now - lastTickRef.current >= FRAME_INTERVAL_MS) {
        lastTickRef.current = now;
        force((n) => (n + 1) % 1_000_000);
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [visible]);

  // Project all endpoints on every render. Cheap; no allocation in the hot path
  // outside this single map.
  const paths = useMemo(() => {
    if (!visible) return [];
    const proj = projectorRef.current;
    if (!proj) return [];
    return edges
      .map((edge) => {
        const a = proj.project(edge.fromLocation[0], edge.fromLocation[1]);
        const b = proj.project(edge.toLocation[0], edge.toLocation[1]);
        if (!a || !b || !a.visible || !b.visible) return null;
        const control = arcControlPoint(a, b, 0.42);
        // Sample the bezier into a polyline; SVG path "M x,y Q cx,cy x2,y2"
        // would work but polylines compose more cleanly with the existing
        // overlay layer that already uses straight segments.
        const points: string[] = [];
        for (let i = 0; i <= ARC_SAMPLES; i++) {
          const t = i / ARC_SAMPLES;
          const p = bezierPoint(a, control, b, t);
          points.push(`${p.x},${p.y}`);
        }
        return {
          edge,
          d: `M ${a.x},${a.y} Q ${control.x},${control.y} ${b.x},${b.y}`,
          a,
          b,
          polyline: points.join(" "),
        };
      })
      .filter(Boolean) as Array<{
      edge: ConnectionEdge;
      d: string;
      a: { x: number; y: number };
      b: { x: number; y: number };
      polyline: string;
    }>;
    // Re-run when projector reference content changes — projectorRef updates
    // happen on every globe frame via the inner buildProjector cache, so we
    // depend on the force counter via the tick loop above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges, visible, projectorRef.current?.state, force]);

  if (!visible) return null;

  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ overflow: "visible" }}
    >
      {paths.map(({ edge, d }) => {
        const colour =
          CHANNEL_COLOR[edge.dominantChannel] ?? "rgba(120,120,120,0.6)";
        const baseWeight = edgeWeight(edge.totalAmount, maxAmount);
        const dimmed =
          focusedAccountId &&
          focusedAccountId !== edge.fromAccountId &&
          focusedAccountId !== edge.toAccountId;
        const highlighted =
          focusedAccountId &&
          (focusedAccountId === edge.fromAccountId ||
            focusedAccountId === edge.toAccountId);
        const opacity = dimmed ? 0.08 : highlighted ? 1 : 0.55;
        const strokeWidth = highlighted ? baseWeight * 1.4 : baseWeight;
        return (
          <path
            key={edge.id}
            d={d}
            fill="none"
            stroke={colour}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            opacity={opacity}
            style={{ transition: "opacity 200ms ease, stroke-width 200ms ease" }}
          />
        );
      })}
    </svg>
  );
}
