import * as bridge from "./src/bridge.js";
import * as library from "./src/library.js";
import * as player from "./src/player.js";
import * as queue from "./src/queue.js";
import * as search from "./src/search.js";
import * as settings from "./src/settings.js";

window.EmbyMusicModules = Object.freeze({
  ...(window.EmbyMusicModules || {}),
  bridge,
  library,
  player,
  queue,
  search,
  settings,
});

await import("./app.js?v=0.93.230");
