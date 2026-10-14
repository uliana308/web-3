// Состояния: menu → countdown → playing ⇄ paused → ending → over
class Game {
  constructor(canvas, input, sfx, hooks) {
    this.input = input;
    this.sfx = sfx;
    this.hooks = hooks;
    this.renderer = new Renderer(canvas);
    this.player = new Player();
    this.questions = new QuestionManager(MEMES);
    this.state = 'menu';
    this.resetRun();
  }

  resetRun() {
    this.player.reset();
    this.questions.reset();
    this.obstacles = [];
    this.coins = [];
    this.particles = [];
    this.gate = null;

    this.speed = RUN.speed;
    this.timeScale = 1;
    this.distance = 0;
    this.bonus = 0;
    this.lives = 3;
    this.correct = 0;
    this.asked = 0;
    this.coinsRun = 0;
    this.mistakes = [];

    this.spawnCursor = 20;
    this.nextQuestionAt = 90;
    this.lastGateAt = -999;
    this.countdown = 0;
    this.goFlash = 0;
    this.endTimer = 0;
    this.won = false;
  }

  get score() {
    return Math.floor(this.distance) + this.bonus;
  }

  start() {
    this.resetRun();
    this.state = 'countdown';
    this.countdown = 3;
    this.lastBeep = null;
    this.input.clear();
  }

  pause() {
    if (this.state !== 'playing' && this.state !== 'countdown') return false;
    this.pausedFrom = this.state;
    this.state = 'paused';
    return true;
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = this.pausedFrom;
    this.input.clear();
  }

  toMenu() {
    this.state = 'menu';
    this.resetRun();
  }

  update(dt) {
    const p = this.player;

    if (this.state === 'paused') return;

    if (this.state === 'menu' || this.state === 'over') {
      this.renderer.update(dt, 7);
      p.update(dt, 7);
      this.followCamera(dt);
      return;
    }

    if (this.state === 'countdown') {
      this.countdown -= dt;
      const n = Math.ceil(this.countdown);
      if (n !== this.lastBeep) {
        this.lastBeep = n;
        this.sfx.play(n > 0 ? 'tick' : 'go');
      }
      p.update(dt, 0);
      if (this.countdown <= 0) {
        this.state = 'playing';
        this.goFlash = 0.7;
        this.input.clear();
      }
      return;
    }

    if (this.state === 'ending') {
      this.step(dt, 0);
      this.endTimer -= dt;
      if (this.endTimer <= 0) this.finish();
      return;
    }

    if (this.input.consume('left') && p.changeLane(-1)) this.sfx.play('lane');
    if (this.input.consume('right') && p.changeLane(1)) this.sfx.play('lane');
    if (this.input.consume('jump') && p.jump()) this.sfx.play('jump');

    this.step(dt, 1);
    this.goFlash = Math.max(0, this.goFlash - dt);

    this.checkCollisions();
    this.updateGate();

    this.spawnCursor -= this.speed * dt * this.timeScale;
    if (this.spawnCursor <= 0) {
      this.spawnPattern();
      const k = Math.pow(this.speed / RUN.speed, 0.6);
      this.spawnCursor = rand(RUN.gap[0], RUN.gap[1]) * k;
    }

    if (!this.gate && this.distance >= this.nextQuestionAt) this.spawnGate();
  }

  step(dt, targetScale) {
    this.timeScale += (targetScale - this.timeScale) * Math.min(1, dt * 5);
    const sdt = dt * this.timeScale;
    if (this.state === 'playing') {
      this.speed = Math.min(RUN.maxSpeed, this.speed + RUN.accel * sdt);
    }
    const dz = this.speed * sdt;
    this.distance += dz;

    this.player.update(sdt, this.speed);
    this.renderer.update(sdt, this.speed);
    this.followCamera(dt);

    for (const o of this.obstacles) o.z -= dz;
    for (const c of this.coins) c.z -= dz;
    if (this.gate) this.gate.z -= dz;
    for (const q of this.particles) {
      q.x += q.vx * sdt;
      q.y += q.vy * sdt;
      q.z += q.vz * sdt - dz;
      q.vy -= 9 * sdt;
      q.life -= sdt;
    }

    this.obstacles = this.obstacles.filter(o => o.z + o.d > -1);
    this.coins = this.coins.filter(c => c.z > -1 && !c.taken);
    this.particles = this.particles.filter(q => q.life > 0);
  }

  followCamera(dt) {
    const r = this.renderer;
    r.camX += (this.player.x * 0.4 - r.camX) * Math.min(1, dt * 6);
  }

  checkCollisions() {
    const p = this.player;
    const pb = p.box();

    for (const o of this.obstacles) {
      if (o.hit || !Collision.boxes(pb, o)) continue;
      o.hit = true;
      if (p.invuln <= 0) {
        this.burst(o.x, 0.5, o.z, '#f43f5e', 14);
        this.damage('hit');
      }
    }

    for (const c of this.coins) {
      if (c.taken) continue;
      if (Collision.boxes(pb, { x: c.x, y: c.y, z: c.z - 0.2, w: 0.8, h: 0.8, d: 0.4 })) {
        c.taken = true;
        this.coinsRun++;
        this.bonus += 10;
        this.burst(c.x, c.y + 0.4, c.z, '#fbbf24', 6);
        this.sfx.play('coin');
      }
    }
  }

  updateGate() {
    const g = this.gate;
    if (!g) return;

    if (!g.resolved && g.z <= PLAYER_Z) {
      g.resolved = true;
      g.chosen = this.player.lane;
      const ok = g.chosen === g.q.correctLane;
      this.asked++;
      if (ok) {
        this.correct++;
        this.bonus += 100;
        this.burst(LANE_X[g.chosen], 1.2, PLAYER_Z + 0.5, '#34d399', 24);
        this.sfx.play('correct');
      } else {
        this.mistakes.push(g.q);
        this.damage('wrong');
      }
      this.hooks.onResult({ ok, chosen: g.chosen, correctLane: g.q.correctLane });
      this.nextQuestionAt = this.distance + rand(RUN.qGap[0], RUN.qGap[1]);

      if (this.asked >= MEMES.length && this.state === 'playing') {
        this.won = true;
        this.state = 'ending';
        this.endTimer = 1.6;
      }
    }

    if (g.z < -3) this.gate = null;
  }

  damage(kind) {
    this.lives--;
    this.player.invuln = 1.4;
    this.player.hurt = 0.7;
    this.renderer.shake = 0.3;
    this.sfx.play(kind === 'wrong' ? 'wrong' : 'hit');
    this.hooks.onDamage(this.lives);
    if (this.lives <= 0) {
      this.state = 'ending';
      this.endTimer = 1.2;
      this.sfx.play('over');
    }
  }

  finish() {
    this.state = 'over';
    this.hooks.onGameOver({
      score: this.score,
      correct: this.correct,
      won: this.won,
      coins: this.coinsRun,
      mistakes: this.mistakes,
    });
    this.obstacles = [];
    this.coins = [];
    this.gate = null;
  }

  spawnGate() {
    const q = this.questions.next();
    this.gate = { z: FAR_Z, q, resolved: false, chosen: null };
    this.lastGateAt = this.distance;
    this.hooks.onQuestion(q);
  }

  spawnPattern() {
    // рядом с воротами препятствий нет
    const beforeGate = !this.gate && this.nextQuestionAt - this.distance < 26;
    const afterGate = this.distance - this.lastGateAt < 16;
    if (beforeGate || afterGate) return;

    const z = FAR_Z;
    const [a, b, c] = shuffle([0, 1, 2]);
    const roll = Math.random();

    if (roll < 0.15) {
      this.coinLine(a, z, 6);
    } else if (roll < 0.5) {
      this.addObstacle('barrier', a, z);
      if (Math.random() < 0.6) this.coinArc(a, z);
      else this.coinLine(b, z - 4, 5);
    } else if (roll < 0.78) {
      this.addObstacle('barrier', a, z);
      this.addObstacle('barrier', b, z);
      this.coinLine(c, z - 3, 4);
    } else {
      this.addObstacle('wall', a, z);
      this.addObstacle('barrier', b, z);
      this.coinLine(c, z - 3, 4);
    }
  }

  addObstacle(kind, lane, z) {
    const o = kind === 'barrier'
      ? { kind, x: LANE_X[lane], y: 0, z, w: 1.25, h: 0.75, d: 0.35 }
      : { kind, x: LANE_X[lane], y: 0, z, w: 1.25, h: 2.2, d: 0.6 };
    this.obstacles.push(o);
  }

  coinLine(lane, z, n) {
    for (let i = 0; i < n; i++) this.coins.push({ x: LANE_X[lane], y: 0, z: z + i * 2.2 });
  }

  coinArc(lane, z) {
    for (let i = -3; i <= 3; i++) {
      const t = i / 3.6;
      this.coins.push({ x: LANE_X[lane], y: 0.25 + 1.25 * (1 - t * t), z: z + 0.2 + i * 1.6 });
    }
  }

  burst(x, y, z, color, n) {
    for (let i = 0; i < n; i++) {
      const life = rand(0.4, 0.8);
      this.particles.push({
        x, y, z, color, life, maxLife: life,
        vx: rand(-2.5, 2.5), vy: rand(1, 5), vz: rand(-2, 2),
      });
    }
  }

  render() {
    const r = this.renderer;
    r.begin();
    r.drawSky();
    r.drawRoad();

    // от дальнего к ближнему
    const items = [];
    for (const p of r.props) if (p.z > 0.6 && p.z < FAR_Z) items.push({ z: p.z, draw: () => r.drawProp(p) });
    for (const o of this.obstacles) if (!o.hit) items.push({ z: o.z, draw: () => r.drawObstacle(o) });
    for (const c of this.coins) items.push({ z: c.z, draw: () => r.drawCoin(c) });
    for (const q of this.particles) items.push({ z: q.z, draw: () => r.drawParticle(q) });
    if (this.gate) items.push({ z: this.gate.z, draw: () => r.drawGate(this.gate) });
    items.push({ z: PLAYER_Z, draw: () => this.player.draw(r) });
    items.sort((a, b) => b.z - a.z).forEach(it => it.draw());

    if (this.state === 'countdown' || (this.state === 'paused' && this.pausedFrom === 'countdown')) {
      const n = Math.max(1, Math.ceil(this.countdown));
      r.drawCenterText(String(n), 1 + (this.countdown % 1) * 0.3);
    } else if (this.goFlash > 0) {
      r.drawCenterText('Погнали!', 0.55);
    }
  }
}
