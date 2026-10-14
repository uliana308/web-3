// Точка мира (x, y, z) проецируется на экран по перспективе: чем дальше z,
// тем ближе к горизонту и тем мельче. s — сколько пикселей в одной единице мира.
class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camX = 0;
    this.scroll = 0;
    this.shake = 0;
    this.time = 0;
    this.clouds = Array.from({ length: 9 }, () => this.makeCloud(Math.random()));
    this.resize();
    this.initScenery();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (w === this.w && h === this.h && dpr === this.dpr) return;
    this.w = w; this.h = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.f = Math.min(h * 0.78, w * 0.85);
    this.cx = w / 2;
    this.horizon = h * 0.88 - CAM_H * this.f / PLAYER_Z;
  }

  project(x, y, z) {
    const s = this.f / Math.max(z, 0.35);
    return { x: this.cx + (x - this.camX) * s, y: this.horizon + (CAM_H - y) * s, s };
  }

  fog(z) {
    return z < 55 ? 1 : Math.max(0, 1 - (z - 55) / 50);
  }

  face(points, fill) {
    const ctx = this.ctx;
    ctx.beginPath();
    points.forEach(([x, y, z], i) => {
      const p = this.project(x, y, z);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  update(dt, speed) {
    this.time += dt;
    this.scroll += speed * dt;
    this.shake = Math.max(0, this.shake - dt);

    for (const c of this.clouds) {
      c.x -= dt * c.v;
      if (c.x < -0.3) Object.assign(c, this.makeCloud(1.3));
    }

    for (const p of this.props) {
      p.z -= speed * dt;
      if (p.z < 0.4) {
        p.z += this.span;
        Object.assign(p, this.propLook(p.side));
      }
    }
  }

  begin() {
    this.resize();
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.shake > 0) {
      const k = this.shake * 30;
      ctx.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
    }
  }

  makeCloud(x) {
    return { x, y: rand(0.08, 0.7), size: rand(0.6, 1.4), v: rand(0.004, 0.012), seed: Math.random() * 10 };
  }

  drawCloud(c) {
    const ctx = this.ctx;
    const r = Math.min(this.w, this.h) * 0.06 * c.size;
    const x = c.x * this.w, y = c.y * this.horizon;
    const puffs = [[0, 0, 1], [-1.1, 0.25, 0.75], [1.1, 0.2, 0.8], [-0.5, -0.45, 0.8], [0.6, -0.4, 0.7], [1.9, 0.35, 0.5], [-1.9, 0.4, 0.5]];
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    for (const [dx, dy, k] of puffs) {
      ctx.beginPath();
      ctx.ellipse(x + dx * r, y + dy * r, r * k * 1.1, r * k * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(180, 205, 235, 0.45)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.45, r * 2.2, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawSky() {
    const { ctx, w, h, horizon } = this;
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#1d5fd1');
    sky.addColorStop(0.6, '#4b93e8');
    sky.addColorStop(1, '#a9d4f7');
    ctx.fillStyle = sky;
    ctx.fillRect(-20, -20, w + 40, horizon + 21);

    for (const c of this.clouds) this.drawCloud(c);

    const shift = this.camX * 6;
    this.drawHill(horizon, h * 0.07, 0.006, 1.3 + shift * 0.002, '#79c247', '#5aa832');
    this.drawHill(horizon, h * 0.035, 0.011, 4.1 + shift * 0.004, '#6bb83a', '#4c9a28');

    const field = ctx.createLinearGradient(0, horizon, 0, h);
    field.addColorStop(0, '#5fae31');
    field.addColorStop(1, '#2f7d16');
    ctx.fillStyle = field;
    ctx.fillRect(-20, horizon, w + 40, h - horizon + 20);
  }

  drawHill(baseY, amp, freq, phase, top, bottom) {
    const { ctx, w } = this;
    const g = ctx.createLinearGradient(0, baseY - amp * 2, 0, baseY);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-20, baseY + 2);
    for (let x = -20; x <= w + 20; x += 12) {
      const y = baseY - amp * (1 + 0.6 * Math.sin(x * freq + phase) + 0.3 * Math.sin(x * freq * 2.3 + phase * 1.7));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w + 20, baseY + 2);
    ctx.closePath();
    ctx.fill();
  }

  drawRoad() {
    const ctx = this.ctx;
    const R = ROAD_HALF, near = 0.5;

    for (let z = -(this.scroll % 8); z < FAR_Z; z += 4) {
      const z0 = Math.max(z, near), z1 = Math.min(z + 4, FAR_Z);
      if (z1 <= near) continue;
      const light = Math.round((z + this.scroll) / 4) % 2 === 0;
      this.face([[-R, 0, z0], [R, 0, z0], [R, 0, z1], [-R, 0, z1]], light ? '#8fd456' : '#7cc646');
    }

    for (const sx of [-0.75, 0.75]) {
      for (let z = 5 - this.scroll % 5; z < 85; z += 5) {
        const z0 = Math.max(z, near), z1 = z + 2;
        if (z1 <= near) continue;
        this.face([[sx - 0.05, 0, z0], [sx + 0.05, 0, z0], [sx + 0.05, 0, z1], [sx - 0.05, 0, z1]],
          `rgba(255, 255, 255, ${0.85 * this.fog(z)})`);
      }
    }

    for (const s of [-1, 1]) {
      this.face([[s * R - 0.06, 0, near], [s * R + 0.06, 0, near], [s * R + 0.06, 0, FAR_Z], [s * R - 0.06, 0, FAR_Z]], 'rgba(255, 255, 255, 0.9)');
    }

    const haze = ctx.createLinearGradient(0, this.horizon - this.h * 0.04, 0, this.horizon + this.h * 0.12);
    haze.addColorStop(0, 'rgba(200, 230, 255, 0)');
    haze.addColorStop(0.35, 'rgba(200, 230, 255, 0.55)');
    haze.addColorStop(1, 'rgba(200, 230, 255, 0)');
    ctx.fillStyle = haze;
    ctx.fillRect(-20, this.horizon - this.h * 0.04, this.w + 40, this.h * 0.16);
  }

  initScenery() {
    this.props = [];
    let z = 1;
    while (z < FAR_Z + 10) {
      for (const side of [-1, 1]) {
        if (Math.random() < 0.8) this.props.push({ side, z: z + rand(0, 2), ...this.propLook(side) });
      }
      z += rand(2.5, 5);
    }
    this.span = z;
  }

  propLook(side) {
    const roll = Math.random();
    const kind = roll < 0.22 ? 'tree' : roll < 0.5 ? 'bush' : 'flowers';
    const minX = kind === 'tree' ? 3.5 : 0.6;
    return {
      kind,
      x: side * (ROAD_HALF + minX + rand(0, kind === 'tree' ? 9 : 6)),
      size: rand(0.8, 1.4),
      color: ['#ffffff', '#ffe066', '#ff8fab', '#c39bff'][randInt(4)],
    };
  }

  drawProp(p) {
    const ctx = this.ctx;
    const alpha = this.fog(p.z);
    if (alpha <= 0) return;
    ctx.globalAlpha = alpha;
    const g = this.project(p.x, 0, p.z);
    const u = g.s * p.size;

    if (p.kind === 'tree') {
      ctx.fillStyle = 'rgba(30, 80, 10, 0.35)';
      ctx.beginPath();
      ctx.ellipse(g.x, g.y, 0.9 * u, 0.2 * u, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7a4a24';
      ctx.fillRect(g.x - 0.12 * u, g.y - 1.4 * u, 0.24 * u, 1.4 * u);
      const crown = [[0, -2.2, 0.95, '#2f8a22'], [-0.55, -1.8, 0.65, '#2a7d1e'], [0.55, -1.75, 0.7, '#2a7d1e'], [0.15, -2.55, 0.55, '#3fa52f']];
      for (const [dx, dy, r, c] of crown) {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(g.x + dx * u, g.y + dy * u, r * u, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (p.kind === 'bush') {
      for (const [dx, dy, r, c] of [[-0.35, -0.3, 0.35, '#3c962a'], [0.35, -0.3, 0.38, '#3c962a'], [0, -0.45, 0.42, '#4cad35']]) {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(g.x + dx * u, g.y + dy * u, r * u, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.strokeStyle = '#2e8a1c';
      ctx.lineWidth = Math.max(1, 0.04 * u);
      ctx.beginPath();
      for (let i = -2; i <= 2; i++) {
        ctx.moveTo(g.x + i * 0.08 * u, g.y);
        ctx.lineTo(g.x + i * 0.16 * u, g.y - (0.35 - Math.abs(i) * 0.05) * u);
      }
      ctx.stroke();
      ctx.fillStyle = p.color;
      for (const [dx, dy] of [[-0.18, -0.38], [0.12, -0.42], [0.3, -0.3]]) {
        ctx.beginPath();
        ctx.arc(g.x + dx * u, g.y + dy * u, Math.max(1, 0.07 * u), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  box(x, y, z, w, h, d, cTop, cSide, cFront) {
    const x0 = x - w / 2, x1 = x + w / 2, y1 = y + h, z1 = z + d;
    if (y1 < CAM_H) this.face([[x0, y1, z], [x1, y1, z], [x1, y1, z1], [x0, y1, z1]], cTop);
    if (x1 < this.camX) this.face([[x1, y, z], [x1, y1, z], [x1, y1, z1], [x1, y, z1]], cSide);
    if (x0 > this.camX) this.face([[x0, y, z], [x0, y1, z], [x0, y1, z1], [x0, y, z1]], cSide);
    this.face([[x0, y, z], [x1, y, z], [x1, y1, z], [x0, y1, z]], cFront);
  }

  drawObstacle(o) {
    if (o.z < 0.4) return;
    const ctx = this.ctx;
    ctx.globalAlpha = this.fog(o.z);
    const a = this.project(o.x - o.w / 2, o.h, o.z), b = this.project(o.x + o.w / 2, 0, o.z);
    const fw = b.x - a.x, fh = b.y - a.y;

    if (o.kind === 'barrier') {
      this.box(o.x, 0, o.z, o.w, o.h, o.d, '#f6d77e', '#c99a3c', '#e9bd55');
      ctx.strokeStyle = 'rgba(150, 105, 30, 0.6)';
      ctx.lineWidth = Math.max(1, fh * 0.04);
      ctx.beginPath();
      for (let i = 1; i < 5; i++) {
        ctx.moveTo(a.x + fw * 0.04, a.y + fh * i / 5);
        ctx.lineTo(b.x - fw * 0.04, a.y + fh * i / 5);
      }
      ctx.stroke();
      ctx.strokeStyle = '#a0522d';
      ctx.lineWidth = Math.max(1.5, fw * 0.035);
      ctx.beginPath();
      ctx.moveTo(a.x + fw * 0.3, a.y); ctx.lineTo(a.x + fw * 0.3, b.y);
      ctx.moveTo(a.x + fw * 0.7, a.y); ctx.lineTo(a.x + fw * 0.7, b.y);
      ctx.stroke();
    } else {
      this.box(o.x, 0, o.z, o.w, o.h, o.d, '#d65a44', '#8e2a1d', '#b8402c');
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = Math.max(1.5, fw * 0.06);
      ctx.strokeRect(a.x + fw * 0.08, a.y + fh * 0.06, fw * 0.84, fh * 0.88);
      ctx.beginPath();
      ctx.moveTo(a.x + fw * 0.08, a.y + fh * 0.06); ctx.lineTo(a.x + fw * 0.92, a.y + fh * 0.94);
      ctx.moveTo(a.x + fw * 0.92, a.y + fh * 0.06); ctx.lineTo(a.x + fw * 0.08, a.y + fh * 0.94);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawCoin(c) {
    if (c.z < 0.6) return;
    const ctx = this.ctx;
    const p = this.project(c.x, c.y + 0.4, c.z);
    const r = 0.27 * p.s;
    const spin = Math.abs(Math.cos(this.time * 4 + c.z * 0.3));
    ctx.globalAlpha = this.fog(c.z);
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, Math.max(r * spin, r * 0.12) + r * 0.08, r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, Math.max(r * spin, r * 0.12), r * 0.92, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.ellipse(p.x - r * spin * 0.25, p.y - r * 0.25, Math.max(r * spin * 0.3, 0.5), r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  drawGate(g) {
    if (g.z < 0.4) return;
    const ctx = this.ctx;
    const alpha = this.fog(g.z);
    if (alpha <= 0) return;
    ctx.globalAlpha = alpha;
    const top = 2.7;

    for (let i = 0; i < 3; i++) {
      const x = LANE_X[i];
      let fill = 'rgba(255, 255, 255, 0.16)';
      if (g.resolved) {
        if (i === g.q.correctLane) fill = 'rgba(52, 211, 153, 0.5)';
        else if (i === g.chosen) fill = 'rgba(244, 63, 94, 0.5)';
      }
      this.face([[x - 0.72, 0, g.z], [x + 0.72, 0, g.z], [x + 0.72, top, g.z], [x - 0.72, top, g.z]], fill);

      const a = this.project(x - 0.68, top - 0.08, g.z), b = this.project(x + 0.68, top - 0.62, g.z);
      ctx.fillStyle = '#fffdf5';
      roundRectPath(ctx, a.x, a.y, b.x - a.x, b.y - a.y, a.s * 0.08);
      ctx.fill();
      ctx.strokeStyle = '#8b5a2b';
      ctx.lineWidth = Math.max(1, a.s * 0.03);
      ctx.stroke();
      const fontPx = a.s * 0.17;
      if (fontPx >= 6) {
        ctx.fillStyle = '#10234a';
        ctx.font = `800 ${fontPx}px Nunito, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.fitText(g.q.options[i].replace(/\n/g, ' '), b.x - a.x - fontPx), (a.x + b.x) / 2, (a.y + b.y) / 2);
      }
    }

    for (const x of [-ROAD_HALF, -0.75, 0.75, ROAD_HALF]) {
      this.box(x, 0, g.z, 0.14, top, 0.14, '#c08552', '#7a4a24', '#a0673a');
    }
    this.box(0, top, g.z, ROAD_HALF * 2 + 0.14, 0.16, 0.14, '#c08552', '#7a4a24', '#a0673a');
    ctx.globalAlpha = 1;
  }

  fitText(text, maxW) {
    const ctx = this.ctx;
    if (ctx.measureText(text).width <= maxW) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
  }

  drawParticle(p) {
    if (p.z < 0.5) return;
    const q = this.project(p.x, p.y, p.z);
    const size = Math.max(2, 0.09 * q.s);
    this.ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    this.ctx.fillStyle = p.color;
    this.ctx.fillRect(q.x - size / 2, q.y - size / 2, size, size);
    this.ctx.globalAlpha = 1;
  }

  drawCenterText(text, scale) {
    const ctx = this.ctx;
    const size = Math.min(this.w, this.h) * 0.2 * scale;
    ctx.save();
    ctx.font = `800 ${size}px Unbounded, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = size * 0.1;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1d4fb8';
    ctx.strokeText(text, this.w / 2, this.h * 0.45);
    ctx.fillStyle = '#fff';
    ctx.fillText(text, this.w / 2, this.h * 0.45);
    ctx.restore();
  }
}
