export function findCurrentIndex(queue, currentTrack, hintedIndex = -1) {
  if (!currentTrack?.Id || !Array.isArray(queue) || !queue.length) {
    return -1;
  }
  if (hintedIndex >= 0 && queue[hintedIndex]?.Id === currentTrack.Id) {
    return hintedIndex;
  }
  return queue.findIndex((track) => track?.Id === currentTrack.Id);
}

export function removeAt(queue, index) {
  if (!Array.isArray(queue) || index < 0 || index >= queue.length) {
    return queue;
  }
  return queue.filter((_, itemIndex) => itemIndex !== index);
}

export function move(queue, fromIndex, toIndex) {
  if (
    !Array.isArray(queue)
    || fromIndex < 0
    || fromIndex >= queue.length
    || toIndex < 0
    || toIndex >= queue.length
    || fromIndex === toIndex
  ) {
    return queue;
  }
  const nextQueue = [...queue];
  const [movedTrack] = nextQueue.splice(fromIndex, 1);
  nextQueue.splice(toIndex, 0, movedTrack);
  return nextQueue;
}

export function replaceRemainder(queue, startIndex, replacement) {
  return [
    ...queue.slice(0, Math.max(0, startIndex)),
    ...replacement,
  ];
}

export function shuffle(items, random = Math.random) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

export function sameById(left, right) {
  return left.length === right.length && left.every((track, index) => track?.Id === right[index]?.Id);
}
