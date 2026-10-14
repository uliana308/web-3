(function () {
  const $ = id => document.getElementById(id);

  const HEART = '<svg viewBox="0 0 24 24"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';

  const save = {
    best: Storage.get('best', 0),
    coins: Storage.get('coins', 0),
    maxLevel: Storage.get('maxLevel', 0),
    muted: Storage.get('muted', false),
  };

  const canvas = $('game');
  const input = new InputHandler($('stage'));
  const sfx = new Sfx(save.muted);

  let resultTimer = null;
  let lastLane = -1;

  const music = new Audio();
  music.loop = true;
  music.volume = 0.6;

  function playMusic(rank) {
    music.src = rank.music;
    music.currentTime = 0;
    if (!sfx.muted) music.play().catch(() => {});
  }

  function stopMusic() {
    music.pause();
  }

  const hooks = {
    onQuestion(q) {
      clearTimeout(resultTimer);
      $('q-img').src = q.image;
      const opts = $('q-opts');
      opts.innerHTML = '';
      opts.classList.toggle('long', q.options.some(t => t.length > 40));
      q.options.forEach((text, lane) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'opt';
        b.textContent = text;
        b.dataset.lane = lane;
        b.addEventListener('click', () => {
          if (game.state !== 'playing') return;
          const p = game.player;
          if (p.lane !== lane) {
            p.lane = lane;
            sfx.play('lane');
          }
        });
        opts.appendChild(b);
      });
      lastLane = -1;
      $('qpanel').classList.add('show');
      fitOptions();
    },

    onResult({ ok, chosen, correctLane }) {
      const opts = $('q-opts').children;
      opts[correctLane].classList.add('ok');
      if (!ok) opts[chosen].classList.add('bad');
      $('qpanel').classList.add(ok ? 'flash-ok' : 'flash-bad');
      resultTimer = setTimeout(hideQuestion, 1300);
    },

    onDamage(lives) {
      renderHearts(lives, true);
    },

    onGameOver(res) {
      hideQuestion();
      showGameOver(res);
    },
  };

  const game = new Game(canvas, input, sfx, hooks);

  // если длинное слово не влезает в кнопку — уменьшаем шрифт сразу у всех трёх вариантов,
  // чтобы размер текста не подсказывал правильный ответ
  function fitOptions() {
    const opts = $('q-opts');
    opts.style.fontSize = '';
    let size = parseFloat(getComputedStyle(opts).fontSize);
    const overflows = () => [...opts.children].some(b => b.scrollWidth > b.clientWidth + 1);
    while (overflows() && size > 12) {
      size -= 1;
      opts.style.fontSize = size + 'px';
    }
  }
  window.addEventListener('resize', fitOptions);

  function hideQuestion() {
    const panel = $('qpanel');
    panel.classList.remove('show', 'flash-ok', 'flash-bad');
  }

  function show(screen) {
    ['menu', 'pause', 'over'].forEach(id => $(id).classList.toggle('hidden', id !== screen));
    if (screen !== 'over') stopMusic();
    const inRun = screen === 'game' || screen === 'pause';
    $('hud').classList.toggle('hidden', !inRun);
    document.body.classList.toggle('in-run', inRun);
    document.body.classList.toggle('paused', screen === 'pause');
  }

  function startRun() {
    sfx.unlock();
    hideQuestion();
    game.start();
    renderHearts(3, false);
    show('game');
  }

  function pauseRun() {
    if (game.pause()) show('pause');
  }

  function resumeRun() {
    game.resume();
    show('game');
  }

  function quitToMenu() {
    hideQuestion();
    game.toMenu();
    renderMenu();
    show('menu');
  }

  function renderMenu() {
    $('menu-coins').textContent = save.coins;

    const levels = $('levels');
    levels.innerHTML = '';
    RANKS.forEach(r => {
      const open = r.level <= save.maxLevel;
      const el = document.createElement('div');
      el.className = 'lvl' + (open ? ' open' : '');
      el.innerHTML = `
        <div class="lvl-img"><img src="${r.image}" alt="">${open ? '' : '<span>?</span>'}</div>
        <div class="lvl-num">ур. ${r.level}</div>
        <div class="lvl-name">${open ? r.title : `от ${r.min} мемов`}</div>`;
      levels.appendChild(el);
    });
    $('levels-count').textContent = `${save.maxLevel} / ${RANKS.length}`;
  }

  function renderHearts(lives, animate) {
    const box = $('hearts');
    box.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const s = document.createElement('span');
      s.className = 'heart' + (i < lives ? '' : ' lost') + (animate && i === lives ? ' pop' : '');
      s.innerHTML = HEART;
      box.appendChild(s);
    }
  }

  function syncHud() {
    if (game.state === 'menu' || game.state === 'over') return;
    $('hud-score').textContent = game.score;
    $('hud-coins').textContent = game.coinsRun;
    $('hud-correct').textContent = `${game.correct} из ${MEMES.length}`;

    const g = game.gate;
    if (g && !g.resolved) {
      if (game.player.lane !== lastLane) {
        lastLane = game.player.lane;
        [...$('q-opts').children].forEach((b, i) => b.classList.toggle('current', i === lastLane));
      }
      const t = clamp((g.z - PLAYER_Z) / (FAR_Z - PLAYER_Z), 0, 1);
      $('q-timer-bar').style.transform = `scaleX(${t})`;
    } else if (g && g.resolved) {
      [...$('q-opts').children].forEach(b => b.classList.remove('current'));
      $('q-timer-bar').style.transform = 'scaleX(0)';
    }
  }

  function showGameOver(res) {
    const rank = getRank(res.correct);
    const isRecord = res.score > save.best;

    save.best = Math.max(save.best, res.score);
    save.coins += res.coins;
    save.maxLevel = Math.max(save.maxLevel, rank.level);
    Storage.set('best', save.best);
    Storage.set('coins', save.coins);
    Storage.set('maxLevel', save.maxLevel);

    $('rc-level').textContent = `Уровень ${rank.level} из ${RANKS.length} · ${rank.tag}`;
    $('rc-img').src = rank.image;
    $('rc-title').textContent = rank.title;
    $('rc-text').textContent = rank.text;
    $('rc-score').textContent = res.score;
    $('rc-new').classList.toggle('hidden', !isRecord);
    $('rc-correct').textContent = `${res.correct} из ${MEMES.length}`;
    $('over-title').textContent = res.won ? `Все ${MEMES.length} мемов пройдены!` : 'Забег окончен';
    $('rc-coins').textContent = `+${res.coins}`;
    $('rc-best').textContent = save.best;

    const list = $('mistakes-list');
    list.innerHTML = '';
    res.mistakes.forEach(q => {
      const el = document.createElement('div');
      el.className = 'mistake';
      el.innerHTML = `<img src="${q.image}" alt=""><span></span>`;
      el.querySelector('span').textContent = q.caption;
      list.appendChild(el);
    });
    $('mistakes').classList.toggle('hidden', res.mistakes.length === 0);

    show('over');
    $('over').scrollTop = 0;
    playMusic(rank);
  }

  $('btn-start').addEventListener('click', startRun);
  $('btn-again').addEventListener('click', startRun);
  $('btn-restart').addEventListener('click', startRun);
  $('btn-resume').addEventListener('click', resumeRun);
  $('btn-quit').addEventListener('click', quitToMenu);
  $('btn-menu').addEventListener('click', quitToMenu);
  $('btn-back').addEventListener('click', quitToMenu);
  $('btn-close').addEventListener('click', quitToMenu);
  $('btn-pause').addEventListener('click', () => {
    if (game.state === 'paused') resumeRun(); else pauseRun();
  });

  function renderSound() {
    document.body.classList.toggle('muted', sfx.muted);
  }
  $('btn-sound').addEventListener('click', () => {
    sfx.unlock();
    sfx.muted = !sfx.muted;
    Storage.set('muted', sfx.muted);
    renderSound();
    if (sfx.muted) stopMusic();
    else if (game.state === 'over') music.play().catch(() => {});
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseRun();
  });

  let lastTime = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    if (input.consume('pause')) {
      if (game.state === 'paused') resumeRun();
      else pauseRun();
    }

    game.update(dt);
    game.render();
    syncHud();
    requestAnimationFrame(loop);
  }

  renderMenu();
  renderSound();
  show('menu');
  requestAnimationFrame(loop);
})();
