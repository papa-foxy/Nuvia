/**
 * Body-shape table for PhysiqueIllustration.
 *
 * Every physique is the same front anatomy figure used by the Workout
 * muscle map (path data from '@/components/workout/anatomy-data'), reshaped
 * per type with plain affine transforms: groups move outward/inward from the
 * body midline ("frame") and each muscle can grow or shrink about its own
 * centre ("bulk"). Head, hair, neck, hands and feet keep their size so all
 * figures stay comparable side by side.
 */
import { ANATOMY_PATHS, type AnatomySlug } from '@/components/workout/anatomy-data';

/** Body midline of the front view, in SVG units. */
const MID_X = 364;
/** Horizontal distance from the midline to each shoulder / leg centre. */
const SHOULDER_OFFSET = 130;
const LEG_OFFSET = 90;

/** Crop of the 724×1448 front view with room for the widest variant. */
export const PHYSIQUE_VIEWBOX = '14 78 696 1284';

export interface PhysiqueShape {
  /** Shoulder width: moves deltoids, arms and hands outward (1 = default). */
  shoulder: number;
  /** Size of chest, deltoids and trapezius about their own centres. */
  upper: number;
  /** Size of biceps, triceps and forearms. */
  arm: number;
  /** Waist width: abs + obliques scaled about the midline. */
  waist: number;
  /** Hip width: moves the legs outward. */
  hip: number;
  /** Size of quadriceps and adductors. */
  thigh: number;
  /** Size of calves and tibialis. */
  calf: number;
  /** Soft-tissue padding (SVG units) drawn under the muscles; 0 = none. */
  padding: number;
  /** Width of the gaps between muscles (definition). */
  stroke: number;
  /** Muscle contrast: % of the text colour mixed into the card colour. */
  tone: number;
  /** How sharply the gaps contrast with the muscles (1 = card colour, 0 = invisible). */
  definition: number;
}

const AVERAGE: PhysiqueShape = {
  shoulder: 1, upper: 1, arm: 1, waist: 1, hip: 1, thigh: 1, calf: 1,
  padding: 0, stroke: 6, tone: 24, definition: 1,
};

export const PHYSIQUE_SHAPES: Record<string, PhysiqueShape> = {
  average: AVERAGE,
  lean: { shoulder: 0.94, upper: 0.88, arm: 0.82, waist: 0.86, hip: 0.94, thigh: 0.82, calf: 0.85, padding: 0, stroke: 6, tone: 21, definition: 1 },
  soft: { shoulder: 1.02, upper: 1, arm: 1.04, waist: 1.13, hip: 1.04, thigh: 1.07, calf: 1.03, padding: 10, stroke: 5, tone: 21, definition: 0.45 },
  higher_body_fat: { shoulder: 1.07, upper: 1.04, arm: 1.1, waist: 1.26, hip: 1.1, thigh: 1.15, calf: 1.08, padding: 16, stroke: 5, tone: 20, definition: 0.25 },
  athletic: { shoulder: 1.07, upper: 1.08, arm: 1.05, waist: 0.94, hip: 1, thigh: 1.04, calf: 1.02, padding: 0, stroke: 7, tone: 26, definition: 1 },
  lean_muscular: { shoulder: 1.04, upper: 1.05, arm: 1, waist: 0.87, hip: 0.95, thigh: 0.94, calf: 0.92, padding: 0, stroke: 8.5, tone: 28, definition: 1 },
  muscular: { shoulder: 1.12, upper: 1.18, arm: 1.16, waist: 0.97, hip: 1.03, thigh: 1.12, calf: 1.07, padding: 0, stroke: 9, tone: 29, definition: 1 },
  strong: { shoulder: 1.16, upper: 1.2, arm: 1.2, waist: 1.1, hip: 1.08, thigh: 1.18, calf: 1.12, padding: 0, stroke: 8, tone: 28, definition: 1 },
  general_fitness: { ...AVERAGE, shoulder: 1.02, upper: 1.03, waist: 0.97, stroke: 6.5, tone: 24 },
};

/** Female variant: narrower shoulders, slightly wider hips; nothing else changes. */
export function femaleShape(s: PhysiqueShape): PhysiqueShape {
  return { ...s, shoulder: s.shoulder * 0.94, upper: s.upper * 0.92, arm: s.arm * 0.94, waist: s.waist * 0.97, hip: s.hip * 1.05, thigh: s.thigh * 1.04 };
}

export const NON_MUSCLE_SLUGS = new Set<AnatomySlug>(['head', 'hair', 'neck', 'hands', 'knees', 'ankles', 'feet']);

type Group = 'fixed' | 'upper' | 'shoulderJoint' | 'arm' | 'hand' | 'core' | 'thigh' | 'knee' | 'calf' | 'foot';

const GROUP_OF: Partial<Record<AnatomySlug, Group>> = {
  head: 'fixed', hair: 'fixed', neck: 'fixed',
  chest: 'upper', trapezius: 'upper',
  deltoids: 'shoulderJoint',
  biceps: 'arm', triceps: 'arm', forearm: 'arm',
  hands: 'hand',
  abs: 'core', obliques: 'core',
  quadriceps: 'thigh', adductors: 'thigh',
  knees: 'knee',
  tibialis: 'calf', calves: 'calf',
  ankles: 'foot', feet: 'foot',
};

/* ------------------------------------------------------------------ */
/* Path bounding boxes (computed once from the path data, no DOM).     */
/* ------------------------------------------------------------------ */

const ARG_COUNT: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
const NUMBER_RE = /^[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/;

/** Approximate centre of a path (bounding box of end and control points). */
function pathCentre(d: string): [number, number] {
  let p = 0;
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let cmd = '';
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const add = (ax: number, ay: number) => {
    if (ax < minX) minX = ax;
    if (ax > maxX) maxX = ax;
    if (ay < minY) minY = ay;
    if (ay > maxY) maxY = ay;
  };
  const skip = () => {
    while (p < d.length && (d[p] === ' ' || d[p] === ',' || d[p] === '\n' || d[p] === '\t')) p++;
  };
  const num = () => {
    skip();
    const m = NUMBER_RE.exec(d.slice(p, p + 32));
    if (!m) throw new Error('bad path');
    p += m[0].length;
    return Number(m[0]);
  };
  const flag = () => {
    skip();
    return Number(d[p++]);
  };
  try {
    for (;;) {
      skip();
      if (p >= d.length) break;
      if (/[a-zA-Z]/.test(d[p])) {
        cmd = d[p++];
        if (cmd === 'z' || cmd === 'Z') {
          x = startX;
          y = startY;
          continue;
        }
      }
      const lc = cmd.toLowerCase();
      const rel = cmd === lc;
      const v: number[] =
        lc === 'a' ? [num(), num(), num(), flag(), flag(), num(), num()] : Array.from({ length: ARG_COUNT[lc] ?? 0 }, num);
      const n = v.length;
      if (n === 0) break;
      if (lc === 'h') x = rel ? x + v[0] : v[0];
      else if (lc === 'v') y = rel ? y + v[0] : v[0];
      else {
        if (lc === 'c' || lc === 's' || lc === 'q') {
          for (let k = 0; k < n - 2; k += 2) add(rel ? x + v[k] : v[k], rel ? y + v[k + 1] : v[k + 1]);
        }
        x = rel ? x + v[n - 2] : v[n - 2];
        y = rel ? y + v[n - 1] : v[n - 1];
      }
      if (lc === 'm') {
        startX = x;
        startY = y;
        cmd = rel ? 'l' : 'L';
      }
      add(x, y);
    }
  } catch {
    // Fall through with whatever was measured.
  }
  if (!Number.isFinite(minX)) return [MID_X, 700];
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

export interface FigurePart {
  slug: AnatomySlug;
  d: string;
  muscle: boolean;
  /** SVG transform attribute, or undefined when unchanged. */
  transform?: string;
}

let basePartsCache: (Omit<FigurePart, 'transform'> & { cx: number; cy: number; group: Group })[] | null = null;

function baseParts() {
  if (basePartsCache) return basePartsCache;
  const front = ANATOMY_PATHS.front;
  const out: (Omit<FigurePart, 'transform'> & { cx: number; cy: number; group: Group })[] = [];
  for (const slug of Object.keys(front) as AnatomySlug[]) {
    for (const d of front[slug] || []) {
      const [cx, cy] = pathCentre(d);
      out.push({ slug, d, muscle: !NON_MUSCLE_SLUGS.has(slug), cx, cy, group: GROUP_OF[slug] ?? 'fixed' });
    }
  }
  basePartsCache = out;
  return out;
}

const r = (n: number) => Math.round(n * 100) / 100;

/** translate(dx,0) · scale(bx,by) about (cx,cy) as a single matrix. */
function matrix(dx: number, bx: number, by: number, cx: number, cy: number): string | undefined {
  const e = dx + cx - bx * cx;
  const f = cy - by * cy;
  if (Math.abs(bx - 1) < 1e-4 && Math.abs(by - 1) < 1e-4 && Math.abs(e) < 0.01) return undefined;
  return `matrix(${r(bx)} 0 0 ${r(by)} ${r(e)} ${r(f)})`;
}

/** Vertical growth follows horizontal bulk, but gently. */
const tall = (b: number) => 1 + (b - 1) * 0.35;

/** Front anatomy figure reshaped for one physique. */
export function buildFigure(shape: PhysiqueShape): FigurePart[] {
  return baseParts().map(({ slug, d, muscle, cx, cy, group }) => {
    const side = cx < MID_X ? -1 : 1;
    const armShift = side * (SHOULDER_OFFSET * (shape.shoulder - 1) + 40 * (shape.arm - 1));
    const legShift = side * LEG_OFFSET * (shape.hip - 1);
    let transform: string | undefined;
    switch (group) {
      case 'upper':
        transform = matrix((cx - MID_X) * (shape.shoulder - 1), shape.upper, tall(shape.upper), cx, cy);
        break;
      case 'shoulderJoint':
        transform = matrix(side * SHOULDER_OFFSET * (shape.shoulder - 1), shape.upper, tall(shape.upper), cx, cy);
        break;
      case 'arm':
        transform = matrix(armShift, shape.arm, 1, cx, cy);
        break;
      case 'hand':
        transform = matrix(armShift, 1, 1, cx, cy);
        break;
      case 'core':
        // Uniform scale about the midline keeps abs and obliques joined.
        transform = matrix(0, shape.waist, 1, MID_X, cy);
        break;
      case 'thigh':
        transform = matrix(legShift, shape.thigh, 1, cx, cy);
        break;
      case 'knee':
      case 'foot':
        transform = matrix(legShift, 1, 1, cx, cy);
        break;
      case 'calf':
        transform = matrix(legShift, shape.calf, 1, cx, cy);
        break;
      default:
        transform = undefined;
    }
    return { slug, d, muscle, transform };
  });
}
