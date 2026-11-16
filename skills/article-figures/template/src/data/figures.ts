import type {Diagram, Figure} from '../map/geometry';

// Sample: one request through a cache. Replace it with the article's figures, one per row of figures.md.
const REQUEST: Diagram = {
  view: [0, 0, 672, 384],
  nodes: [
    {id: 'client', box: [0, 120, 112, 70], hue: 'blue', title: 'Client', lines: [{text: 'Browser or app'}, {text: 'HTTPS', key: true}]},
    {id: 'gateway', box: [172, 120, 128, 70], hue: 'teal', title: 'Gateway', lines: [{text: 'Auth, rate limits'}, {text: 'Cache first'}]},
    {id: 'cache', box: [370, 20, 130, 70], hue: 'pink', title: 'Cache', lines: [{text: 'Hot data only'}, {text: 'Redis', key: true}]},
    {id: 'service', box: [370, 220, 130, 70], hue: 'green', title: 'Service', lines: [{text: 'Computes, then'}, {text: 'fills the cache'}]},
    {id: 'db', box: [580, 220, 92, 70], hue: 'pink', title: 'Database', lines: [{text: 'All data'}, {text: 'PostgreSQL', key: true}]},
  ],
  edges: [
    {id: 'e-req', paths: [{d: 'M112 155H172', arrow: 'end'}], labels: [{x: 142, y: 146, text: 'request', anchor: 'middle'}]},
    {id: 'e-hit', tone: 'teal', paths: [{d: 'M236 120V55H370', arrow: 'end'}], labels: [{x: 303, y: 46, text: 'lookup', anchor: 'middle'}]},
    {id: 'e-miss', tone: 'orange', paths: [{d: 'M236 190V255H370', arrow: 'end'}], labels: [{x: 303, y: 246, text: 'on a miss', anchor: 'middle'}]},
    {id: 'e-db', paths: [{d: 'M500 255H580', arrow: 'both'}], labels: [{x: 540, y: 246, text: 'reads, writes', anchor: 'middle'}]},
  ],
  legend: {
    at: [0, 304],
    paths: [
      {label: 'Hit: answered at once', tone: 'teal'},
      {label: 'Miss: via the service', tone: 'orange'},
    ],
    hues: [
      {hue: 'blue', label: 'Caller'},
      {hue: 'teal', label: 'Entry'},
      {hue: 'green', label: 'Service'},
      {hue: 'pink', label: 'Storage'},
    ],
  },
};

// A cover's diagram is the subject at a glance: few boxes, drawn to fill the cover's panel.
const COVER: Diagram = {
  view: [0, 0, 400, 300],
  nodes: [
    {id: 'client', box: [0, 132, 110, 36], hue: 'blue', title: 'Client', center: true},
    {id: 'cache', box: [290, 40, 110, 36], hue: 'pink', title: 'Cache', center: true},
    {id: 'service', box: [290, 224, 110, 36], hue: 'green', title: 'Service', center: true},
  ],
  edges: [
    {id: 'hit', tone: 'teal', paths: [{d: 'M110 150H180V58H290', arrow: 'end'}], labels: [{x: 235, y: 49, text: 'hit', anchor: 'middle'}]},
    {id: 'miss', tone: 'orange', paths: [{d: 'M180 150V242H290', arrow: 'end'}], labels: [{x: 235, y: 233, text: 'miss', anchor: 'middle'}]},
  ],
};

export const FIGURES: Figure[] = [
  {
    id: 'cover',
    kind: 'cover',
    title: 'How a cache answers a request',
    subtitle: 'A hit returns at once, and a miss goes on to the service.',
    diagram: COVER,
  },
  {id: 'request-path', kind: 'still', title: 'A request through a cache', subtitle: 'A hit returns at once; a miss goes on to the service.', diagram: REQUEST},
  {
    id: 'cache-miss',
    kind: 'gif',
    title: 'On a miss',
    diagram: REQUEST,
    steps: [
      {n: ['client', 'gateway'], e: ['e-req'], at: [142, 172]},
      {n: ['cache'], e: ['e-hit'], at: [303, 72]},
      {n: ['service'], e: ['e-miss'], at: [303, 272]},
      {n: ['db'], e: ['e-db'], at: [540, 272]},
    ],
  },
];
