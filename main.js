import * as bridge from "./src/bridge.js";
import * as coverColor from "./src/cover-color.js";
import * as library from "./src/library.js";
import * as localData from "./src/local-data.js";
import * as player from "./src/player.js";
import * as queue from "./src/queue.js";
import * as search from "./src/search.js";
import * as settings from "./src/settings.js";
import * as store from "./src/store.js";

window.EmbyMusicModules = Object.freeze({
  ...(window.EmbyMusicModules || {}),
  bridge,
  coverColor,
  library,
  localData,
  player,
  queue,
  search,
  settings,
  store,
});

await import("./app.js?v=0.94.5");
