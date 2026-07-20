import * as library from "./src/library.js";
import * as player from "./src/player.js";
import * as queue from "./src/queue.js";
import * as search from "./src/search.js";

window.EmbyMusicModules = Object.freeze({
  ...(window.EmbyMusicModules || {}),
  library,
  player,
  queue,
  search,
});

await import("./app.js?v=0.93.230");
