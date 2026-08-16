const queue = new Set();

function coalesce(fn) {
  return () => queue.add(fn);
}

function processQueue() {
  const fns = Array.from(queue.values());
  queue.clear();
  for (const fn of fns) {
    fn();
  }
  requestAnimationFrame(processQueue);
}

processQueue();

export { coalesce };
