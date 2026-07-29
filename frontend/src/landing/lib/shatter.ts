import { Delaunay } from 'd3-delaunay';

export interface Cell {
  polygon: [number, number][];
  center: [number, number];
  area: number;
  index: number;
}

export interface ShatterResult {
  cells: Cell[];
  totalArea: number;
}

function polygonArea(pts: [number, number][]): number {
  let area = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += pts[i][0] * pts[j][1];
    area -= pts[j][0] * pts[i][1];
  }
  return Math.abs(area) / 2;
}

function polygonCentroid(pts: [number, number][]): [number, number] {
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p[0]; cy += p[1]; }
  return [cx / pts.length, cy / pts.length];
}

export function generateSeeds(
  clickX: number,
  clickY: number,
  width: number,
  height: number,
  count: number = 120,
): [number, number][] {
  const seeds: [number, number][] = [];
  const radius = Math.max(width, height) * 0.6;
  const innerRadius = 30;

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = innerRadius + Math.random() * (radius - innerRadius);
    const jitter = (Math.random() - 0.5) * 40;
    const x = Math.max(0, Math.min(width, clickX + Math.cos(angle) * dist + jitter));
    const y = Math.max(0, Math.min(height, clickY + Math.sin(angle) * dist + jitter));
    seeds.push([x, y]);
  }

  seeds.push([0, 0], [width, 0], [0, height], [width, height]);
  seeds.push([width / 2, 0], [width / 2, height], [0, height / 2], [width, height / 2]);

  return seeds;
}

export function computeVoronoi(
  seeds: [number, number][],
  width: number,
  height: number,
): ShatterResult {
  const delaunay = Delaunay.from(seeds);
  const voronoi = delaunay.voronoi([0, 0, width, height]);
  const cells: Cell[] = [];
  let totalArea = 0;

  for (let i = 0; i < seeds.length; i++) {
    const poly = voronoi.cellPolygon(i);
    if (!poly) continue;

    const pts: [number, number][] = poly.map(p => [p[0], p[1]]);
    const area = polygonArea(pts);
    const center = polygonCentroid(pts);

    totalArea += area;
    cells.push({ polygon: pts, center, area, index: i });
  }

  return { cells, totalArea };
}

export function cellsNearPoint(
  cells: Cell[],
  x: number,
  y: number,
  radius: number,
): Cell[] {
  return cells.filter(c => {
    const dx = c.center[0] - x;
    const dy = c.center[1] - y;
    return Math.sqrt(dx * dx + dy * dy) < radius;
  });
}

export function drawCellPath(
  ctx: CanvasRenderingContext2D,
  polygon: [number, number][],
) {
  ctx.beginPath();
  ctx.moveTo(polygon[0][0], polygon[0][1]);
  for (let i = 1; i < polygon.length; i++) {
    ctx.lineTo(polygon[i][0], polygon[i][1]);
  }
  ctx.closePath();
}
