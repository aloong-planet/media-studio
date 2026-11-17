import assert from 'node:assert/strict';
import {test} from 'node:test';
import {figureLayout} from '../src/figure/layout.ts';
import {figureProblems} from '../src/map/geometry.ts';

const DIAGRAM = {
  view: [0, 0, 300, 100],
  nodes: [
    {id: 'a', box: [0, 0, 80, 40], hue: 'blue', title: 'A'},
    {id: 'b', box: [200, 0, 80, 40], hue: 'pink', title: 'B'},
  ],
  edges: [{id: 'ab', tone: 'teal', paths: [{d: 'M80 20H200', arrow: 'end'}]}],
  legend: {at: [0, 80], paths: [{label: 'Lookup', tone: 'teal'}], hues: [{hue: 'blue', label: 'Caller'}, {hue: 'pink', label: 'Storage'}]},
};
const STILL = {id: 'request', kind: 'still', title: 'A request', diagram: DIAGRAM};
const GIF = {id: 'steps', kind: 'gif', title: 'Steps', diagram: DIAGRAM, steps: [{n: ['a', 'b'], e: ['ab'], at: [140, 32]}]};
const step = (s) => ({...GIF, steps: [{...GIF.steps[0], ...s}]});

// Each case: a figure as src/data/figures.ts would give it, and what stops pnpm render before anything is drawn.
for (const [what, figure, problems] of [
  ['a still drawn by the rules', STILL, []],
  ['an animated figure drawn by the rules', GIF, []],
  ['a cover, which has no legend', {id: 'cover', kind: 'cover', title: 'T', subtitle: 'S.', diagram: {...DIAGRAM, legend: undefined}}, []],
  ['an id that is no file name', {...STILL, id: 'Request_1'}, ['Request_1: an id is lowercase letters, digits and single hyphens']],
  ['a path with a lowercase letter', {...STILL, diagram: {...DIAGRAM, edges: [{...DIAGRAM.edges[0], paths: [{d: 'M80 20h120'}]}]}}, ['request: Path may use only M, L, H and V: M80 20h120']],
  ['a route with a curve', {...STILL, diagram: {...DIAGRAM, routes: {back: {d: 'M0 0C1 1 2 2 3 3', edge: 'ab'}}}}, ['request: Path may use only M, L, H and V: M0 0C1 1 2 2 3 3']],
  ['a body figure without a legend', {...STILL, diagram: {...DIAGRAM, legend: undefined}}, ['request: the diagram needs a legend']],
  ['a legend that misses a hue and a path colour', {...STILL, diagram: {...DIAGRAM, legend: {...DIAGRAM.legend, paths: [], hues: [DIAGRAM.legend.hues[0]]}}}, ['request: the legend is missing pink, teal']],
  ['a step that lights a box not drawn', step({n: ['x']}), ['steps: step 1 lights x, which is not in the diagram']],
  ['a step whose dot has no route', step({flows: ['nowhere']}), ['steps: step 1 sends a dot along nowhere, which is no route']],
  ['a step that lights no line', step({e: []}), ['steps: step 1 lights no line']],
]) {
  test(`a figure is checked before it is drawn: ${what}`, () => {
    assert.deepEqual(figureProblems(figure), problems);
  });
}

test('a view wider than a figure has room for is refused', () => {
  assert.throws(() => figureLayout('wide', [0, 0, 673, 100]), /wide: the diagram's view is 673 wide; a figure has room for 672/);
});

// A figure is the 24-unit margin, the 26-unit title line, an optional 4 + 18 for the subtitle, 20 before the diagram,
// the diagram and the margin again, rounded up to even: 24 + 26 + 20 + 101 + 24 = 195 becomes 196, and 217 becomes 218.
for (const [what, subtitle, height] of [
  ['with a title only', undefined, 196],
  ['with a subtitle', 'One sentence.', 218],
]) {
  test(`a figure is as tall as its heading and diagram, in an even number of units: ${what}`, () => {
    assert.equal(figureLayout('x', [0, 0, 672, 101], subtitle).height, height);
  });
}
