import { geoOrthographic, type GeoProjection } from "d3-geo";

export interface GlobeProjectionState {
  rotation: [number, number];
  scale: number;
  width: number;
  height: number;
}

export interface ProjectedPoint {
  x: number;
  y: number;
  visible: boolean;
}

export interface Projector {
  state: GlobeProjectionState;
  projection: GeoProjection;
  project: (lat: number, lng: number) => ProjectedPoint | null;
}

export function buildProjector(state: GlobeProjectionState): Projector {
  const { rotation, scale, width, height } = state;
  const r = (Math.min(width, height) / 2) * 0.96 * scale;
  const projection = geoOrthographic()
    .scale(r)
    .translate([width / 2, height / 2])
    .rotate([rotation[0], rotation[1], 0])
    .clipAngle(90);

  function project(lat: number, lng: number): ProjectedPoint | null {
    const visible = isVisible(lng, lat, rotation[0], rotation[1]);
    const pt = projection([lng, lat]);
    if (!pt) return null;
    return { x: pt[0], y: pt[1], visible };
  }

  return { state, projection, project };
}

export function isVisible(
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

export function bezierPoint(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

export function arcControlPoint(
  from: { x: number; y: number },
  to: { x: number; y: number },
  lift = 0.35,
): { x: number; y: number } {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return { x: mx, y: my - dist * lift };
}
