import type {Diagram} from '../map/geometry';

// Sample: one request through a cache. Replace it with the video's own diagram.
export const DIAGRAM: Diagram = {
  view: [20, 40, 1160, 470],
  nodes: [
    {id: 'client', box: [40, 190, 170, 90], hue: 'blue', title: '客户端', titleSize: 15, lines: [{text: '浏览器、App'}, {text: 'HTTPS', key: true}]},
    {id: 'gateway', box: [300, 190, 190, 90], hue: 'teal', title: '网关', titleSize: 15, lines: [{text: '鉴权、限流'}, {text: '先查缓存'}]},
    {id: 'cache', box: [600, 60, 220, 90], hue: 'pink', title: '缓存', titleSize: 15, lines: [{text: '只放读得多的数据'}, {text: 'Redis', key: true}]},
    {id: 'service', box: [600, 320, 220, 90], hue: 'green', title: '业务服务', titleSize: 15, lines: [{text: '算出结果，写回缓存'}]},
    {id: 'db', box: [930, 320, 220, 90], hue: 'pink', title: '数据库', titleSize: 15, lines: [{text: '持久保存全部数据'}, {text: 'PostgreSQL', key: true}]},
  ],
  edges: [
    {id: 'e-req', paths: [{d: 'M210 235H300', arrow: 'end'}], labels: [{x: 255, y: 257, text: '请求', anchor: 'middle'}]},
    {id: 'e-hit', tone: 'teal', paths: [{d: 'M395 190V105H600', arrow: 'end'}], labels: [{x: 500, y: 94, text: '查缓存', anchor: 'middle'}]},
    {id: 'e-miss', tone: 'orange', paths: [{d: 'M395 280V365H600', arrow: 'end'}], labels: [{x: 500, y: 354, text: '未命中', anchor: 'middle'}]},
    {id: 'e-db', paths: [{d: 'M820 365H930', arrow: 'both'}], labels: [{x: 875, y: 354, text: '读写', anchor: 'middle'}]},
  ],
  legend: {
    at: [40, 410],
    paths: [
      {label: '命中：直接返回', tone: 'teal'},
      {label: '未命中：走业务', tone: 'orange'},
    ],
    hues: [
      {hue: 'blue', label: '外部调用方'},
      {hue: 'teal', label: '入口层'},
      {hue: 'green', label: '业务层'},
      {hue: 'pink', label: '存储'},
    ],
  },
};
