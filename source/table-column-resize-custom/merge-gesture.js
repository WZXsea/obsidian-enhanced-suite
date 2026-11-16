// Explicit merge picking owns cell gestures; touch scrolling remains native.
function tcrMergePointerSelection({enabled, pointAt, start, extend, tap}) {
  let pointer = null;
  const same = (a, b) => a && b && a.r === b.r && a.c === b.c;
  const stop = (event, prevent = false) => {
    if (prevent) event.preventDefault();
    event.stopImmediatePropagation();
  };
  return {
    reset() { pointer = null; },
    handle(event) {
      if (!enabled()) { pointer = null; return; }
      const point = pointAt(event);
      if (event.type === 'pointerdown') {
        if (event.isPrimary === false) {
          pointer = null;
          if (point) stop(event);
          return;
        }
        if (event.button !== 0 || !point) return;
        pointer = {id: event.pointerId, touch: event.pointerType === 'touch', x: event.clientX, y: event.clientY, point, moved: false};
        stop(event, !pointer.touch);
        if (!pointer.touch) start(point, event);
        return;
      }
      if (!pointer || event.pointerId !== pointer.id) return;
      const current = pointer;
      if (event.type === 'pointercancel') { pointer = null; return; }
      if (current.touch) {
        if (Math.hypot(event.clientX - current.x, event.clientY - current.y) > 10) { pointer = null; return; }
        stop(event);
        if (event.type === 'pointerup') {
          pointer = null;
          if (same(point, current.point)) { event.preventDefault(); tap(point, event); }
        }
      } else {
        stop(event, true);
        if (point && (!same(point, current.point) || current.moved)) {
          current.moved = true;
          extend(point, event);
        }
        if (event.type === 'pointerup') pointer = null;
      }
    }
  };
}
