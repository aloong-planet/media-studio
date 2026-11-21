// The blocks a cover's main visual is drawn from, in src/data/cover.tsx. Each is plain HTML, so pnpm stills measures
// all of its text, and its outermost element carries data-block, the name pnpm stills reports it by.
import React from 'react';
import {C, GRADIENTS, GradientHue, HUES, Hue, MONO, SANS, SHADOW} from '../theme';

const SHADOWED = `0 1px 2px ${SHADOW}, 0 8px 24px ${SHADOW}`;

// Gradient text: the colour is the gradient, clipped to the glyphs. pnpm stills measures the contrast of its ends.
const gradient = (hue: GradientHue): React.CSSProperties => {
  const [from, to] = GRADIENTS[hue];
  return {backgroundImage: `linear-gradient(100deg, ${from}, ${to})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent'};
};

const Dot: React.FC<{hue: Hue}> = ({hue}) => <span style={{flex: 'none', width: 10, height: 10, borderRadius: 5, background: HUES[hue].line}} />;

// A card: a coloured dot and a small grey label, the main finding as its heading, then the blocks it holds.
export const Card: React.FC<{dot: Hue; label: string; heading: string; style?: React.CSSProperties; children?: React.ReactNode}> = ({dot, label, heading, style, children}) => (
  <div data-block="card" style={{boxSizing: 'border-box', padding: '26px 30px', background: C.panel, borderRadius: 16, boxShadow: SHADOWED, ...style}}>
    <div style={{display: 'flex', alignItems: 'center', gap: 10, fontFamily: SANS, fontWeight: 600, fontSize: 20, color: C.muted}}>
      <Dot hue={dot} />
      {label}
    </div>
    <div style={{marginTop: 10, fontFamily: SANS, fontWeight: 600, fontSize: 30, lineHeight: 1.3, color: C.ink}}>{heading}</div>
    {children}
  </div>
);

// One figure per tile. unit is one of 亿, 次, 万, %; approx writes ≈ before the figure.
export type Stat = {value: string; unit?: string; approx?: boolean; label: string; hue: GradientHue};

const StatTile: React.FC<{stat: Stat}> = ({stat}) => (
  <div data-block="number tile" style={{borderRadius: 16, padding: '24px 26px 22px', background: HUES[stat.hue].fill, boxShadow: SHADOWED}}>
    <div style={{display: 'inline-block', fontFamily: SANS, fontWeight: 600, fontSize: 52, lineHeight: 1.1, whiteSpace: 'nowrap', letterSpacing: -0.5, ...gradient(stat.hue)}}>
      {stat.approx ? <span style={{fontSize: '0.7em', marginRight: 6}}>≈</span> : null}
      {stat.value}
      {stat.unit ? <span style={{fontSize: '0.58em', marginLeft: 4}}>{stat.unit}</span> : null}
    </div>
    <div style={{marginTop: 8, fontFamily: SANS, fontSize: 20, color: C.muted, whiteSpace: 'nowrap'}}>{stat.label}</div>
  </div>
);

export const StatTiles: React.FC<{stats: Stat[]; columns: number; style?: React.CSSProperties}> = ({stats, columns, style}) => (
  <div style={{display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 16, ...style}}>
    {stats.map((s) => (
      <StatTile key={s.label} stat={s} />
    ))}
  </div>
);

// What a tool or a change of work replaces. does is an optional line under the name.
export type Change = {hue: GradientHue; name: string; does?: string; before: string; after: string; result: string; note: string};

export const BeforeAfter: React.FC<{change: Change; style?: React.CSSProperties}> = ({change: c, style}) => {
  // Amber's name and 现在 tag are in its gradient's lighter end; every other hue's are in its ink.
  const accent = c.hue === 'amber' ? GRADIENTS.amber[1] : HUES[c.hue].ink;
  const row: React.CSSProperties = {display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, fontFamily: SANS, fontSize: 20, lineHeight: 1.4, whiteSpace: 'nowrap'};
  const tag: React.CSSProperties = {flex: 'none', fontFamily: SANS, fontWeight: 600, fontSize: 17, borderRadius: 999, padding: '3px 12px'};
  return (
    <div data-block="before/after" style={{borderRadius: 12, padding: '20px 22px', background: HUES[c.hue].fill, ...style}}>
      <div style={{fontFamily: MONO, fontWeight: 600, fontSize: 26, color: accent}}>{c.name}</div>
      {c.does ? <div style={{marginTop: 4, fontFamily: SANS, fontWeight: 600, fontSize: 22, color: C.ink}}>{c.does}</div> : null}
      <div style={row}>
        <span style={{...tag, background: C.band, color: C.muted}}>以前</span>
        <span style={{color: C.muted, textDecoration: 'line-through', textDecorationColor: C.line}}>{c.before}</span>
      </div>
      <div style={row}>
        <span style={{...tag, background: accent, color: C.onHue}}>现在</span>
        <span style={{color: C.ink}}>{c.after}</span>
      </div>
      <div style={{display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${HUES[c.hue].line}`, whiteSpace: 'nowrap'}}>
        <span style={{fontFamily: SANS, fontWeight: 600, fontSize: 36, lineHeight: 1.1, letterSpacing: -0.5, ...gradient(c.hue)}}>{c.result}</span>
        <span style={{fontFamily: SANS, fontSize: 20, color: C.ink}}>{c.note}</span>
      </div>
    </div>
  );
};

// A table read down its columns: one row per case, one column per part. A cell is null where the case does not reach
// the part; hue gives it another hue than its column's, deep the deeper fill for a bigger value.
export type Column = {name: string; hue: Hue};
export type Cell = {text: string; hue?: Hue; deep?: boolean} | null;
export type Row = {name: string; note?: string; cells: Cell[]};

export const ColumnTable: React.FC<{columns: Column[]; rows: Row[]; nameWidth: number; rowHeight: number; rowGap: number; style?: React.CSSProperties}> = ({columns, rows, nameWidth, rowHeight, rowGap, style}) => {
  for (const r of rows) if (r.cells.length !== columns.length) throw new Error(`cover table, row ${r.name}: ${r.cells.length} cells for ${columns.length} columns`);
  return (
    <div data-block="column table" style={{display: 'grid', gridTemplateColumns: `${nameWidth}px repeat(${columns.length}, 1fr)`, columnGap: 12, rowGap, marginTop: 22, alignItems: 'center', ...style}}>
      <div />
      {columns.map((c) => (
        <div key={c.name} style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 6, fontFamily: SANS, fontWeight: 600, fontSize: 19, color: C.muted, whiteSpace: 'nowrap'}}>
          <Dot hue={c.hue} />
          {c.name}
        </div>
      ))}
      {rows.map((r) => (
        <React.Fragment key={r.name}>
          <div>
            <div style={{fontFamily: SANS, fontWeight: 600, fontSize: 22, lineHeight: 1.3, color: C.ink, whiteSpace: 'nowrap'}}>{r.name}</div>
            {r.note ? <div style={{marginTop: 2, fontFamily: SANS, fontSize: 17, lineHeight: 1.35, color: C.muted}}>{r.note}</div> : null}
          </div>
          {r.cells.map((cell, i) => {
            const hue = HUES[cell?.hue ?? columns[i].hue];
            return (
              <div
                key={i}
                data-fit
                style={{height: rowHeight, overflow: 'hidden', borderRadius: 12, display: 'grid', placeItems: 'center', fontFamily: SANS, fontWeight: 600, fontSize: 21, whiteSpace: 'nowrap', background: cell ? (cell.deep ? hue.lit : hue.fill) : HUES.gray.fill, color: hue.ink}}
              >
                {cell?.text}
              </div>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
};
