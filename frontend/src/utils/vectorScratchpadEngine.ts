import { getStroke } from 'perfect-freehand';

export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export interface StrokeData {
  id: string;
  tool: 'pen' | 'eraser' | 'text' | 'math';
  color: string;
  size: number;
  points: Point[];
  textContent?: string;
  mathContent?: string;
  textPos?: { x: number; y: number };
}

/**
 * Converts outline points from perfect-freehand into a smooth SVG path d attribute string
 */
function getSvgPathFromStroke(strokePoints: number[][]): string {
  if (strokePoints.length === 0) return '';

  const d = strokePoints.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ['M', ...strokePoints[0], 'Q']
  );

  d.push('Z');
  return d.join(' ');
}

/**
 * Generates an SVG path string for a set of input points using perfect-freehand smoothing
 */
export function renderVectorStrokePath(points: Point[], size: number = 4): string {
  if (points.length < 2) return '';

  const inputPoints = points.map((p) => [p.x, p.y, p.pressure ?? 0.5]);

  const outlinePoints = getStroke(inputPoints, {
    size,
    thinning: 0.65,
    smoothing: 0.6,
    streamline: 0.5,
    easing: (t) => t,
    simulatePressure: true,
  });

  return getSvgPathFromStroke(outlinePoints);
}

/**
 * Checks if a tap coordinate (x, y) is near a stroke (for vector eraser)
 */
export function isPointNearStroke(stroke: StrokeData, x: number, y: number, threshold: number = 15): boolean {
  if (!stroke.points || stroke.points.length === 0) return false;

  for (const p of stroke.points) {
    const dist = Math.hypot(p.x - x, p.y - y);
    if (dist <= threshold) {
      return true;
    }
  }
  return false;
}
