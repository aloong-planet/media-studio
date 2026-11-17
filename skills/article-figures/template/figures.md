# Figure list

The list the author agreed to, one row per file. `pnpm render` stops when the figures drawn in `src/data/figures.ts` differ from it, and `pnpm deliver` reports each file's section and alt text from it.

| File | Section | Kind | Title | Shows | Alt text |
|---|---|---|---|---|---|
| `cover.png` | Cover | cover | How a cache answers a request | Subtitle: a hit returns at once, a miss goes on to the service. A small diagram of the request path. | Cover: a request path through a cache |
| `request-path.png` | Request path | still | A request through a cache | The client, gateway, cache, service and database, and the two paths a request takes | A request goes from the client through the gateway to the cache or to the service |
| `cache-miss.gif` | On a miss | gif | On a miss | Step by step: the request, the lookup that misses, the service and the database | A request that misses the cache goes on to the service and the database |
