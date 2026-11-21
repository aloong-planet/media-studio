// The covers: the platforms the video goes out on, and its main visual, drawn inside the area each cover gives it from
// the blocks in src/ui/CoverBlocks.tsx. Sample: replace both with the video's own.
import React from 'react';
import {Card, ColumnTable} from '../ui/CoverBlocks';
import type {CoverBodyProps, Platforms} from '../ui/platforms';

export const PLATFORMS: Platforms = ['wechat-channels'];

// The two cases down the rows, the parts of the diagram across, each part in its box's colour. The card sits in the
// middle of the area: the sample has no more to say than this one table.
export const CoverBody: React.FC<CoverBodyProps> = ({ratio, width, height}) => (
  <div style={{height, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
    <Card dot="blue" label="两种情况" heading="缓存命中不碰数据库，未命中读一次数据库">
      <ColumnTable
        columns={[
          {name: '网关', hue: 'teal'},
          {name: '缓存', hue: 'pink'},
          {name: '业务服务', hue: 'green'},
          {name: '数据库', hue: 'pink'},
        ]}
        rows={[
          {name: '缓存命中', note: '刚看过的页面再打开一次', cells: [{text: '先查缓存'}, {text: '直接返回'}, null, null]},
          {name: '缓存未命中', note: '第一次打开这个页面', cells: [{text: '先查缓存'}, {text: '没有这份数据'}, {text: '算出结果'}, {text: '读一次'}]},
        ]}
        nameWidth={Math.round(width * 0.22)}
        rowHeight={ratio === '3x4' || ratio === '9x16' ? 200 : 150}
        rowGap={28}
      />
    </Card>
  </div>
);
