function rand(min, max) {
  return min + Math.random() * (max - min);
}

function randInt(n) {
  return Math.floor(Math.random() * n);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Обёртка над localStorage: в приватном режиме он может бросать ошибки
const Storage = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem('memeRunner.' + key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem('memeRunner.' + key, JSON.stringify(value));
    } catch (e) {}
  },
};
