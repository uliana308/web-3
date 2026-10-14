class InputHandler {
  constructor(touchTarget) {
    this.pressed = new Set();

    window.addEventListener('keydown', e => {
      const action = InputHandler.KEYS[e.code];
      if (!action) return;
      e.preventDefault();
      if (!e.repeat) this.pressed.add(action);
    });

    let sx = 0, sy = 0;
    touchTarget.addEventListener('touchstart', e => {
      const t = e.changedTouches[0];
      sx = t.clientX;
      sy = t.clientY;
    }, { passive: true });

    touchTarget.addEventListener('touchend', e => {
      if (e.target.closest('button')) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) this.pressed.add('jump');
      else if (Math.abs(dx) > Math.abs(dy)) this.pressed.add(dx < 0 ? 'left' : 'right');
      else if (dy < 0) this.pressed.add('jump');
    }, { passive: true });
  }

  consume(action) {
    const had = this.pressed.has(action);
    this.pressed.delete(action);
    return had;
  }

  clear() {
    this.pressed.clear();
  }
}

InputHandler.KEYS = {
  ArrowLeft: 'left',  KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Space: 'jump', KeyW: 'jump', ArrowUp: 'jump',
  KeyP: 'pause', Escape: 'pause',
};
