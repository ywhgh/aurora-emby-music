import * as player from "./src/player.js";
import * as queue from "./src/queue.js";

window.EmbyMusicModules = Object.freeze({
  ...(window.EmbyMusicModules || {}),
  player,
  queue,
});

await import("./app.js?v=0.93.230");
