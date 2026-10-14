class Player {
  constructor() {
    this.reset();
  }

  reset() {
    this.lane = 1;
    this.x = LANE_X[1];
    this.y = 0;
    this.vy = 0;
    this.onGround = true;
    this.invuln = 0;
    this.hurt = 0;
    this.runPhase = 0;
    this.tilt = 0;
    this.squash = 0;
  }

  changeLane(dir) {
    const lane = clamp(this.lane + dir, 0, 2);
    if (lane === this.lane) return false;
    this.lane = lane;
    return true;
  }

  jump() {
    if (!this.onGround) return false;
    this.vy = JUMP_V;
    this.onGround = false;
    return true;
  }

  update(dt, speed) {
    const prevX = this.x;
    this.x += (LANE_X[this.lane] - this.x) * Math.min(1, dt * 14);
    const vx = dt > 0 ? (this.x - prevX) / dt : 0;
    this.tilt += (clamp(vx * 0.03, -0.35, 0.35) - this.tilt) * Math.min(1, dt * 12);

    if (!this.onGround) {
      this.vy -= GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        this.onGround = true;
        this.squash = 1;
      }
    }

    this.squash = Math.max(0, this.squash - dt * 5);
    this.invuln = Math.max(0, this.invuln - dt);
    this.hurt = Math.max(0, this.hurt - dt);
    this.runPhase += dt * (4 + speed * 0.7);
  }

  box() {
    return { x: this.x, y: this.y, z: PLAYER_Z - 0.3, w: 0.7, h: 1.1, d: 0.6 };
  }

  draw(r) {
    const ctx = r.ctx;
    if (this.invuln > 0 && Math.floor(this.invuln * 10) % 2 === 0) ctx.globalAlpha = 0.35;

    const g = r.project(this.x, 0, PLAYER_Z);
    const k = 1 / (1 + this.y * 0.7);
    ctx.fillStyle = `rgba(20, 60, 10, ${0.35 * k})`;
    ctx.beginPath();
    ctx.ellipse(g.x, g.y, 0.48 * g.s * k, 0.13 * g.s * k, 0, 0, Math.PI * 2);
    ctx.fill();

    const p = r.project(this.x, this.y, PLAYER_Z);
    const u = p.s * 0.92;
    const stretch = this.onGround ? -this.squash * 0.18 : 0.08;
    const step = this.onGround ? Math.sin(this.runPhase) : 0;
    const bob = this.onGround ? Math.abs(step) * 0.05 * u : 0;
    const line = Math.max(1.5, 0.028 * u);

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(this.tilt);
    ctx.scale(1 - stretch, 1 + stretch);
    ctx.lineWidth = line;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111';

    [-1, 1].forEach(side => {
      const lift = this.onGround ? Math.max(0, side * step) * 0.1 * u : 0.06 * u;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(side * 0.2 * u, -0.05 * u - lift, 0.11 * u, 0.06 * u, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    ctx.translate(0, -bob);

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(-0.48 * u, -0.1 * u);
    ctx.bezierCurveTo(-0.58 * u, -0.6 * u, -0.34 * u, -1.22 * u, 0, -1.22 * u);
    ctx.bezierCurveTo(0.34 * u, -1.22 * u, 0.58 * u, -0.6 * u, 0.48 * u, -0.1 * u);
    ctx.quadraticCurveTo(0, 0.02 * u, -0.48 * u, -0.1 * u);
    ctx.fill();
    ctx.stroke();

    const look = this.tilt * 0.2 * u;
    const eyeY = -0.86 * u;
    [-1, 1].forEach(side => {
      const ex = side * 0.2 * u + look;
      if (this.hurt > 0) {
        const e = 0.06 * u;
        ctx.beginPath();
        ctx.moveTo(ex - e, eyeY - e); ctx.lineTo(ex + e, eyeY + e);
        ctx.moveTo(ex + e, eyeY - e); ctx.lineTo(ex - e, eyeY + e);
        ctx.stroke();
        return;
      }
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, 0.07 * u, 0.085 * u, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = line * 0.6;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.ellipse(ex + (k - 1) * 0.012 * u, eyeY + (k % 2) * 0.01 * u, 0.085 * u, 0.098 * u, k * 0.6, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.lineWidth = line;
    });

    const blush = ctx.createRadialGradient(look, -0.63 * u, 0, look, -0.63 * u, 0.1 * u);
    blush.addColorStop(0, 'rgba(255, 150, 190, 0.95)');
    blush.addColorStop(1, 'rgba(255, 150, 190, 0)');
    ctx.fillStyle = blush;
    ctx.beginPath();
    ctx.arc(look, -0.63 * u, 0.1 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(look - 0.05 * u, -0.58 * u);
    ctx.quadraticCurveTo(look, -0.55 * u, look + 0.05 * u, -0.58 * u);
    ctx.stroke();

    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.moveTo(-0.11 * u, -0.49 * u);
    ctx.quadraticCurveTo(0, -0.36 * u, 0.11 * u, -0.49 * u);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff9ec2';
    ctx.beginPath();
    ctx.ellipse(0.01 * u, -0.43 * u, 0.06 * u, 0.055 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const lx = 0.1 * u, ly = -0.27 * u, lr = 0.16 * u;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx + 0.02 * u, -0.08 * u);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(lx, ly, lr, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, 0.035 * u);
    const turn = this.runPhase * 0.3;
    let prev = null;
    for (let t = 0; t <= Math.PI * 6; t += 0.25) {
      const rr = lr * 0.95 * t / (Math.PI * 6);
      const pt = [lx + Math.cos(t + turn) * rr, ly + Math.sin(t + turn) * rr];
      if (prev) {
        ctx.strokeStyle = `hsl(${(t * 50) % 360}, 90%, 58%)`;
        ctx.beginPath();
        ctx.moveTo(prev[0], prev[1]);
        ctx.lineTo(pt[0], pt[1]);
        ctx.stroke();
      }
      prev = pt;
    }
    ctx.lineWidth = line;
    ctx.strokeStyle = '#111';
    ctx.beginPath();
    ctx.arc(lx, ly, lr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(lx + 0.02 * u, -0.08 * u, 0.05 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const hy = -1.1 * u;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, hy, 0.3 * u, 0.26 * u, 0, Math.PI, 0);
    ctx.closePath();
    ctx.clip();
    [['#e23b3b', -0.3, -0.12], ['#4a8fd8', -0.12, 0.13], ['#f5d547', 0.13, 0.22], ['#4a8fd8', 0.22, 0.3]].forEach(([c, a, b]) => {
      ctx.fillStyle = c;
      ctx.fillRect(a * u, hy - 0.3 * u, (b - a) * u, 0.32 * u);
    });
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(0, hy, 0.3 * u, 0.26 * u, 0, Math.PI, 0);
    ctx.closePath();
    ctx.stroke();
    ctx.strokeStyle = '#1e3a5f';
    ctx.beginPath();
    ctx.moveTo(0, hy - 0.26 * u);
    ctx.lineTo(0, hy - 0.34 * u);
    ctx.stroke();
    const blade = Math.cos(this.runPhase * 1.6) * 0.2 * u;
    ctx.fillStyle = '#1e3a5f';
    ctx.beginPath();
    ctx.ellipse(blade / 2, hy - 0.35 * u, Math.abs(blade) / 2 + 0.01 * u, 0.03 * u, 0, 0, Math.PI * 2);
    ctx.ellipse(-blade / 2, hy - 0.35 * u, Math.abs(blade) / 2 + 0.01 * u, 0.03 * u, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
