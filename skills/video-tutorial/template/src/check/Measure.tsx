// Runs inside the rendered frame when pnpm stills asks for it, and reports what the eye cannot judge.
// Text below 0.9 opacity is skipped for contrast: it is the part of the diagram dimmed while a route is followed.
import React, {useEffect} from 'react';
import {continueRender, delayRender, getInputProps, useCurrentFrame} from 'remotion';
import {DIAGRAM} from '../data/diagram';
import {pathSegments} from '../map/path';

const MIN_CONTRAST = 4.5;
const MIN_BADGE_GAP = 2; // map units of clear space around a step number
const MIN_ARROW_RATIO = 2.5;
const MAX_BADGE_RATIO = 2;

type Rgb = [number, number, number];
const parse = (c: string): {rgb: Rgb; a: number} => {
  const m = (c.match(/[\d.]+/g) ?? ['0', '0', '0', '0']).map(Number);
  return {rgb: [m[0], m[1], m[2]], a: m.length > 3 ? m[3] : 1};
};
const luminance = (rgb: Rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (p: Rgb, q: Rgb) => {
  const [hi, lo] = [luminance(p), luminance(q)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
};
// What the eye gets: text drawn at some opacity over its background.
const blend = (fg: Rgb, bg: Rgb, a: number): Rgb => [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a)];
const opacityOf = (e: Element, stop: Element) => {
  let op = 1;
  for (let n: Element | null = e; n && n !== stop; n = n.parentElement) op *= +getComputedStyle(n).opacity;
  return op;
};

const hueOf = ([r, g, b]: Rgb) => {
  const [hi, lo] = [Math.max(r, g, b), Math.min(r, g, b)];
  if (hi === lo) return 0;
  const raw = hi === r ? (g - b) / (hi - lo) : hi === g ? 2 + (b - r) / (hi - lo) : 4 + (r - g) / (hi - lo);
  return (raw * 60 + 360) % 360;
};
const MAX_HUE_GAP = 15; // degrees; each family's ink and outline measure within 6
const hueGap = (p: Rgb, q: Rgb) => {
  const gap = Math.abs(hueOf(p) - hueOf(q));
  return Math.min(gap, 360 - gap);
};

type Rect = {x: number; y: number; w: number; h: number};
type Seg = {x1: number; y1: number; x2: number; y2: number; half: number; what: string};

const boxSegs = (r: Rect, what: string): Seg[] => [
  {x1: r.x, y1: r.y, x2: r.x + r.w, y2: r.y, half: 1, what},
  {x1: r.x + r.w, y1: r.y, x2: r.x + r.w, y2: r.y + r.h, half: 1, what},
  {x1: r.x, y1: r.y + r.h, x2: r.x + r.w, y2: r.y + r.h, half: 1, what},
  {x1: r.x, y1: r.y, x2: r.x, y2: r.y + r.h, half: 1, what},
];
const pointToSeg = (px: number, py: number, s: Seg) => {
  const [dx, dy] = [s.x2 - s.x1, s.y2 - s.y1];
  const l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((px - s.x1) * dx + (py - s.y1) * dy) / l)) : 0;
  return Math.hypot(px - (s.x1 + t * dx), py - (s.y1 + t * dy));
};
const pointToRect = (px: number, py: number, r: Rect) => Math.hypot(Math.max(r.x - px, 0, px - r.x - r.w), Math.max(r.y - py, 0, py - r.y - r.h));
const segHitsRect = (s: Seg, r: Rect) => Math.max(s.x1, s.x2) > r.x && Math.min(s.x1, s.x2) < r.x + r.w && Math.max(s.y1, s.y2) > r.y && Math.min(s.y1, s.y2) < r.y + r.h;
const rectsHit = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const opaqueBehind = (e: Element): Rgb => {
  for (let n: Element | null = e; n; n = n.parentElement) {
    const c = parse(getComputedStyle(n).backgroundColor);
    if (c.a === 1) return c.rgb;
  }
  return [255, 255, 255];
};

const DIMMED_IN_STILL = 'dimmed text in a static frame';

const checkHtml = (root: HTMLElement, problems: string[], isStatic: boolean) => {
  const bounds = root.getBoundingClientRect();
  for (const e of root.querySelectorAll('*')) {
    if (e.closest('svg') || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim())) continue;
    const text = (e.textContent ?? '').trim().slice(0, 18);
    const range = document.createRange();
    range.selectNodeContents(e);
    const r = range.getBoundingClientRect();
    if (r.left < bounds.left + 20 || r.right > bounds.right - 20 || r.top < bounds.top || r.bottom > bounds.bottom) problems.push(`text leaves the frame: ${text}`);
    const opacity = opacityOf(e, root);
    if (opacity < 0.9) {
      if (isStatic) problems.push(`${DIMMED_IN_STILL}: ${text}`);
      continue;
    }
    const behind = opaqueBehind(e);
    const c = contrast(blend(parse(getComputedStyle(e).color).rgb, behind, opacity), behind);
    if (c < MIN_CONTRAST) problems.push(`contrast ${c.toFixed(2)}: ${text}`);
  }
  for (const e of root.querySelectorAll('[data-fit]')) {
    if (e.scrollHeight > e.clientHeight || e.scrollWidth > e.clientWidth) problems.push(`text overflows its cell: ${(e.textContent ?? '').slice(0, 18)}`);
  }
};

const checkSvg = (svg: SVGSVGElement, root: HTMLElement, problems: string[], isStatic: boolean) => {
  const panel = opaqueBehind(svg);
  // getBBox ignores the element's own group transforms, so legend rows would all appear at one spot without this.
  const rectOf = (e: SVGGraphicsElement): Rect => {
    const b = e.getBBox();
    const m = svg.getCTM()!.inverse().multiply(e.getCTM()!);
    return {x: b.x * m.a + m.e, y: b.y * m.d + m.f, w: b.width * m.a, h: b.height * m.d};
  };

  const lines: Seg[] = [];
  for (const p of svg.querySelectorAll<SVGPathElement>('path[data-line]')) {
    const pieces = pathSegments(p.getAttribute('d')!);
    const half = parseFloat(getComputedStyle(p).strokeWidth) / 2;
    for (const [a, b] of pieces) lines.push({x1: a[0], y1: a[1], x2: b[0], y2: b[1], half, what: `line ${p.getAttribute('d')}`});
    const head = p.getAttribute('data-head');
    if (head) {
      const ends = p.hasAttribute('data-both') ? [pieces[0], pieces[pieces.length - 1]] : [pieces[pieces.length - 1]];
      for (const [a, b] of ends) {
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (length < MIN_ARROW_RATIO * +head) problems.push(`arrow's end segment is ${length} long, head ${head}: ${p.getAttribute('d')}`);
      }
    }
  }

  const boxes = [...svg.querySelectorAll<SVGRectElement>('[data-box] > rect')].map((r) => ({el: r, rect: rectOf(r)}));
  const texts = [...svg.querySelectorAll<SVGTextElement>('text')]
    .filter((t) => !t.closest('[data-badge]') && t.getBBox().width)
    .map((t) => ({el: t, rect: rectOf(t), text: (t.textContent ?? '').trim().slice(0, 18)}));

  const bands = [...svg.querySelectorAll<SVGRectElement>('[data-box="band"] > rect')].map((r) => ({rect: rectOf(r), fill: parse(getComputedStyle(r).fill).rgb}));
  const swatches = [...svg.querySelectorAll<SVGRectElement>('[data-legend] rect')].map(rectOf);

  // The covers show exactly the diagram's view, so anything outside it is cut off there.
  const [vx, vy, vw, vh] = DIAGRAM.view;
  const SLACK = 0.01; // the transform above leaves rounding errors such as 929.9999999999999
  const outside = (x: number, y: number) => x < vx - SLACK || y < vy - SLACK || x > vx + vw + SLACK || y > vy + vh + SLACK;
  for (const l of lines) if (outside(l.x1, l.y1) || outside(l.x2, l.y2)) problems.push(`${l.what} is outside the diagram's view`);
  for (const b of boxes) if (outside(b.rect.x, b.rect.y) || outside(b.rect.x + b.rect.w, b.rect.y + b.rect.h)) problems.push(`a box at ${b.rect.x},${b.rect.y} is outside the diagram's view`);
  for (const t of texts) if (outside(t.rect.x, t.rect.y) || outside(t.rect.x + t.rect.w, t.rect.y + t.rect.h)) problems.push(`text is outside the diagram's view: ${t.text}`);

  texts.forEach((t, i) => {
    if (swatches.some((r) => rectsHit(t.rect, r))) problems.push(`text overlaps a legend swatch: ${t.text}`);
    const own = t.el.closest('[data-box]')?.querySelector<SVGRectElement>('rect') ?? null;
    if (own) {
      const r = rectOf(own);
      if (t.rect.x < r.x || t.rect.x + t.rect.w > r.x + r.w || t.rect.y < r.y || t.rect.y + t.rect.h > r.y + r.h) problems.push(`text leaves its box: ${t.text}`);
    }
    for (const l of lines) if (segHitsRect(l, t.rect)) problems.push(`text crossed by a line: ${t.text}`);
    for (const b of boxes) {
      // A grey band is a background, and a label's halo hides its edge; only real boxes count here.
      if (b.el === own || b.el.parentElement?.getAttribute('data-box') !== 'node') continue;
      for (const s of boxSegs(b.rect, 'box')) if (segHitsRect(s, t.rect)) problems.push(`text crossed by a box edge: ${t.text}`);
    }
    for (const o of texts.slice(i + 1)) if (rectsHit(t.rect, o.rect)) problems.push(`text overlaps text: ${t.text} / ${o.text}`);
    const opacity = opacityOf(t.el, root);
    if (own && t.el.hasAttribute('data-identity') && hueGap(parse(getComputedStyle(t.el).fill).rgb, parse(getComputedStyle(own).stroke).rgb) > MAX_HUE_GAP) problems.push(`identity word is not in its box's colour: ${t.text}`);
    if (opacity < 0.9 && isStatic) problems.push(`${DIMMED_IN_STILL}: ${t.text}`);
    if (opacity >= 0.9) {
      // A label's halo is panel-coloured wherever it sits; a column heading sits on whatever is behind it.
      const behindHeading = t.el.hasAttribute('data-label') ? undefined : bands.find((b) => rectsHit(t.rect, b.rect))?.fill;
      const under = own ? parse(getComputedStyle(own).fill).rgb : (behindHeading ?? panel);
      const c = contrast(blend(parse(getComputedStyle(t.el).fill).rgb, under, opacity), under);
      if (c < MIN_CONTRAST) problems.push(`contrast ${c.toFixed(2)}: ${t.text}`);
    }
  });

  const badges = [...svg.querySelectorAll<SVGGElement>('[data-badge]')].map((g) => ({
    x: +g.getAttribute('data-x')!,
    y: +g.getAttribute('data-y')!,
    r: +g.getAttribute('data-r')!,
    font: +g.getAttribute('data-font')!,
    no: g.querySelector('text')!.textContent,
    edges: g.getAttribute('data-edges')!.split(' ').filter(Boolean),
    tone: g.getAttribute('data-tone'),
    now: g.hasAttribute('data-now'),
    fill: parse(getComputedStyle(g.querySelector('circle')!).fill).rgb,
    stroke: parse(getComputedStyle(g.querySelector('circle')!).stroke).rgb,
    number: parse(getComputedStyle(g.querySelector('text')!).fill).rgb,
  }));
  const segs = [...lines, ...boxes.flatMap((b) => boxSegs(b.rect, 'box'))];
  badges.forEach((b, i) => {
    if ((2 * b.r) / b.font > MAX_BADGE_RATIO) problems.push(`step ${b.no}: circle over twice the digit's size`);
    if (contrast(b.number, b.fill) < MIN_CONTRAST) problems.push(`step ${b.no}: digit contrast below ${MIN_CONTRAST}`);
    if (String(b.fill) !== String(b.now ? b.stroke : panel)) problems.push(`step ${b.no}: the current step must be solid, passed steps hollow`);
    for (const s of segs) if (pointToSeg(b.x, b.y, s) - b.r - s.half < MIN_BADGE_GAP) problems.push(`step ${b.no} touches ${s.what}`);
    for (const t of texts) if (pointToRect(b.x, b.y, t.rect) - b.r < MIN_BADGE_GAP) problems.push(`step ${b.no} touches text: ${t.text}`);
    const marked = b.edges
      .flatMap((id) => [...svg.querySelectorAll<SVGPathElement>(`path[data-edge="${id}"]`)])
      .map((p) => ({
        tone: p.getAttribute('data-tone'),
        distance: Math.min(...pathSegments(p.getAttribute('d')!).map(([s, e]) => pointToSeg(b.x, b.y, {x1: s[0], y1: s[1], x2: e[0], y2: e[1], half: 0, what: ''}))),
      }));
    if (marked.length) {
      const nearest = marked.reduce((x, y) => (y.distance < x.distance ? y : x));
      if (nearest.distance - b.r > 2 * b.r) problems.push(`step ${b.no} is ${(nearest.distance - b.r).toFixed(0)} away from the line it marks, wider than itself`);
      if (nearest.tone !== b.tone) problems.push(`step ${b.no} is ${b.tone} but the line beside it is ${nearest.tone}`);
    }
    for (const o of badges.slice(i + 1)) if (Math.hypot(b.x - o.x, b.y - o.y) - b.r - o.r < MIN_BADGE_GAP) problems.push(`step ${b.no} touches step ${o.no}`);
  });
};

const Measuring: React.FC<{tag: string}> = ({tag}) => {
  const frame = useCurrentFrame();
  useEffect(() => {
    const handle = delayRender('measure');
    document.fonts.ready.then(() => {
      const root = document.getElementById('frame')!;
      const problems: string[] = [];
      const isStatic = tag.startsWith('cover');
      checkHtml(root, problems, isStatic);
      const svg = root.querySelector<SVGSVGElement>('svg#map');
      if (svg) checkSvg(svg, root, problems, isStatic);
      const luminances = [root, svg?.parentElement].filter(Boolean).map((e) => luminance(opaqueBehind(e!)));
      console.log(`MEASURE ${JSON.stringify({tag, frame, problems: [...new Set(problems)], luminance: Math.min(...luminances)})}`);
      continueRender(handle);
    });
  }, [frame, tag]);
  return null;
};

export const Measure: React.FC<{tag: string}> = ({tag}) => (getInputProps().measure ? <Measuring tag={tag} /> : null);
