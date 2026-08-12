(function () {
  'use strict';

  /* ---------- audio: everything synthesized, nothing sourced/sampled ---------- */

  var actx = null;
  function ac() {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    return actx;
  }

  function tone(freq, start, dur, type, peak, glideTo) {
    var c = ac();
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, start);
    if (glideTo) osc.frequency.linearRampToValueAtTime(glideTo, start + dur);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak || 0.18, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  var sfx = {
    charge: function () {
      var c = ac(), t = c.currentTime;
      tone(220, t, 0.9, 'sawtooth', 0.06, 900);
    },
    footstep: function () {
      var c = ac(), t = c.currentTime;
      tone(110 + Math.random() * 20, t, 0.05, 'square', 0.05);
    },
    jump: function () {
      var c = ac(), t = c.currentTime;
      tone(320, t, 0.14, 'square', 0.15, 720);
    },
    coin: function () {
      var c = ac(), t = c.currentTime;
      tone(988, t, 0.09, 'triangle', 0.16);
      tone(1319, t + 0.07, 0.14, 'triangle', 0.18);
    },
    hit: function () {
      var c = ac(), t = c.currentTime;
      tone(420, t, 0.22, 'sawtooth', 0.14, 120);
    },
    stomp: function () {
      var c = ac(), t = c.currentTime;
      tone(180, t, 0.09, 'square', 0.16, 60);
      tone(900, t + 0.06, 0.08, 'triangle', 0.1);
    },
    fanfare: function (big) {
      var c = ac(), t = c.currentTime;
      var notes = big
        ? [523, 659, 784, 1047, 784, 1047, 1319]
        : [523, 659, 784, 1047];
      var step = big ? 0.11 : 0.1;
      notes.forEach(function (f, i) {
        tone(f, t + i * step, step + 0.05, 'square', 0.15);
      });
    }
  };

  var bgLoop = { timer: null, muted: false };
  function startBgLoop() {
    if (bgLoop.timer) return;
    var pattern = [220, 0, 277, 0, 330, 0, 277, 0];
    var i = 0;
    function step() {
      if (bgLoop.muted) { i = (i + 1) % pattern.length; bgLoop.timer = setTimeout(step, 260); return; }
      var f = pattern[i % pattern.length];
      if (f) tone(f, ac().currentTime, 0.16, 'triangle', 0.045);
      i++;
      bgLoop.timer = setTimeout(step, 260);
    }
    step();
  }
  function stopBgLoop() {
    if (bgLoop.timer) { clearTimeout(bgLoop.timer); bgLoop.timer = null; }
  }

  /* ---------- assets ---------- */

  function loadImage(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.src = src;
    });
  }

  /* ---------- inline game component (lives inside the header's signal line) ---------- */

  var STATE = { INTRO: 'intro', PLAY: 'play', WIN: 'win' };

  function start(container, callbacks) {
    var stage = document.createElement('div');
    stage.className = 'ofer-game-stage';
    stage.innerHTML =
      '<canvas class="ofer-game-canvas"></canvas>' +
      '<div class="ofer-game-hud"><span class="ofer-hud-coins">&#9679; <b>0</b></span></div>' +
      '<div class="ofer-game-corner">' +
      '  <button class="ofer-game-btn" data-action="mute" aria-label="Mute">&#128266;</button>' +
      '  <button class="ofer-game-btn" data-action="close" aria-label="Close game">&times;</button>' +
      '</div>' +
      '<div class="ofer-game-hint">&larr; &rarr; move &middot; space / &uarr; jump</div>' +
      '<div class="ofer-touch ofer-touch-left"><button data-k="left">&#9664;</button><button data-k="right">&#9654;</button></div>' +
      '<div class="ofer-touch ofer-touch-right"><button data-k="jump">&#9650;</button></div>';
    container.appendChild(stage);

    var canvas = stage.querySelector('.ofer-game-canvas');
    var ctx = canvas.getContext('2d');
    var W = 800, H = 400;
    canvas.width = W;
    canvas.height = H;

    var closeBtn = stage.querySelector('[data-action="close"]');
    var muteBtn = stage.querySelector('[data-action="mute"]');
    var hudCoins = stage.querySelector('.ofer-hud-coins b');
    var hint = stage.querySelector('.ofer-game-hint');

    var stopped = false;
    function requestClose() {
      if (stopped) return;
      callbacks.onRequestClose();
    }
    closeBtn.addEventListener('click', requestClose);
    muteBtn.addEventListener('click', function () {
      bgLoop.muted = !bgLoop.muted;
      muteBtn.innerHTML = bgLoop.muted ? '&#128263;' : '&#128266;';
    });

    var keys = {};
    var JUMP_KEYS = ['ArrowUp', 'w', ' '];
    function onKeyDown(e) {
      if (e.key === 'Escape') { requestClose(); return; }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', ' ', 'a', 'd', 'w'].indexOf(e.key) !== -1) e.preventDefault();
      keys[e.key] = true;
      if (JUMP_KEYS.indexOf(e.key) !== -1) keys.__jumpQueued = true;
    }
    function onKeyUp(e) { keys[e.key] = false; }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    stage.querySelectorAll('.ofer-touch button').forEach(function (btn) {
      var k = btn.getAttribute('data-k');
      var down = function (ev) { ev.preventDefault(); keys['touch_' + k] = true; if (k === 'jump') keys.__jumpQueued = true; };
      var up = function (ev) { ev.preventDefault(); keys['touch_' + k] = false; };
      btn.addEventListener('touchstart', down, { passive: false });
      btn.addEventListener('touchend', up, { passive: false });
      btn.addEventListener('mousedown', down);
      btn.addEventListener('mouseup', up);
      btn.addEventListener('mouseleave', up);
    });

    function stop() {
      if (stopped) return;
      stopped = true;
      stopBgLoop();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      stage.remove();
    }

    Promise.all([
      loadImage('assets/mini-ofer-sprite.png'),
      loadImage('assets/game-bug.png'),
      loadImage('assets/game-flag.png')
    ]).then(function (imgs) {
      if (stopped) return;
      runGame(ctx, W, H, imgs[0], imgs[1], imgs[2], {
        close: requestClose,
        isClosed: function () { return stopped; },
        onCoins: function (n) { hudCoins.textContent = n; },
        hideHint: function () { hint.classList.add('is-hidden'); },
        keys: keys
      });
    });

    return { stop: stop };
  }

  function runGame(ctx, W, H, sheet, bugImg, flagImg, ui) {
    var isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var accent = '#0B7A52', accentLight = '#52C695';
    var sky1 = isDark ? '#171612' : '#FCFCFA';
    var sky2 = isDark ? '#20241f' : '#eef6f0';

    var FRAME_W = sheet.width / 5, FRAME_H = sheet.height;
    var FRAMES = { idle: 0, walk1: 1, walk2: 2, jump: 3, win: 4 };
    var charW = 62, charH = charW * (FRAME_H / FRAME_W);

    var groundY = H - 70;
    var levelWidth = 3400;

    var player = {
      x: -60, y: groundY - charH, vx: 0, vy: 0,
      w: charW, h: charH,
      grounded: true, facing: 1, invuln: 0
    };

    var coins = [];
    for (var i = 0; i < 9; i++) {
      coins.push({
        x: 420 + i * 340 + (i % 3) * 40,
        y: groundY - 90 - (i % 3) * 45,
        r: 14, got: false, bob: Math.random() * Math.PI * 2
      });
    }

    var gaps = [
      { x: 900, w: 90 },
      { x: 1850, w: 100 },
      { x: 2650, w: 90 }
    ];

    var bugs = [
      { x: 700, y: 0, w: 44, h: 38, dir: 1, range: 60, base: 700, alive: true, hurt: 0 },
      { x: 1500, y: 0, w: 44, h: 38, dir: -1, range: 80, base: 1500, alive: true, hurt: 0 },
      { x: 2250, y: 0, w: 44, h: 38, dir: 1, range: 70, base: 2250, alive: true, hurt: 0 },
      { x: 3000, y: 0, w: 44, h: 38, dir: -1, range: 90, base: 3000, alive: true, hurt: 0 }
    ];
    bugs.forEach(function (b) { b.y = groundY - b.h; });

    var flagX = levelWidth - 120;

    var state = STATE.INTRO;
    var camX = 0;
    var coinCount = 0;
    var animT = 0;
    var animFrame = FRAMES.idle;
    var introWalkTargetX = 170;
    var introStarted = false;
    var winT = 0;
    var particles = [];

    function isGap(worldX) {
      for (var i = 0; i < gaps.length; i++) {
        if (worldX > gaps[i].x && worldX < gaps[i].x + gaps[i].w) return true;
      }
      return false;
    }

    var last = performance.now();
    function frame(now) {
      if (ui.isClosed()) return;
      var dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      update(dt);
      draw();
      requestAnimationFrame(frame);
    }

    function update(dt) {
      if (state === STATE.INTRO) {
        if (!introStarted) {
          introStarted = true;
          sfx.fanfare(false);
          startBgLoop();
        }
        player.x += 95 * dt;
        animT += dt;
        animFrame = (Math.floor(animT * 8) % 2 === 0) ? FRAMES.walk1 : FRAMES.walk2;
        if (Math.floor(animT * 8) % 2 === 0 && Math.random() < 0.15) sfx.footstep();
        if (player.x >= introWalkTargetX) {
          player.x = introWalkTargetX;
          state = STATE.PLAY;
          ui.hideHint();
          setTimeout(function () {
            var h = document.querySelector('.ofer-game-hint');
            if (h) h.classList.add('is-hidden');
          }, 2200);
        }
        return;
      }

      if (state === STATE.WIN) {
        winT += dt;
        particles.forEach(function (p) {
          p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt; p.life -= dt;
        });
        particles = particles.filter(function (p) { return p.life > 0; });
        if (winT > 0.4 && winT < 0.45) {
          for (var i = 0; i < 40; i++) {
            particles.push({
              x: player.x + player.w / 2, y: player.y,
              vx: (Math.random() - 0.5) * 300,
              vy: -Math.random() * 350 - 100,
              life: 1 + Math.random(),
              color: [accent, accentLight, '#ffd166', '#ef476f'][i % 4]
            });
          }
        }
        return;
      }

      /* PLAY */
      var left = keys('ArrowLeft', 'a', 'touch_left');
      var right = keys('ArrowRight', 'd', 'touch_right');
      var jumpKey = keys('ArrowUp', 'w', ' ', 'touch_jump') || ui.keys.__jumpQueued;

      var speed = 250;
      player.vx = 0;
      if (left && !right) { player.vx = -speed; player.facing = -1; }
      if (right && !left) { player.vx = speed; player.facing = 1; }

      if (jumpKey && player.grounded) {
        player.vy = -620;
        player.grounded = false;
        sfx.jump();
      }
      ui.keys.__jumpQueued = false;

      player.vy += 1700 * dt;
      player.x += player.vx * dt;
      player.y += player.vy * dt;

      if (player.x < 0) player.x = 0;
      if (player.x > levelWidth) player.x = levelWidth;

      var footWorldX = player.x + player.w / 2;
      var overGap = isGap(footWorldX);
      var floorY = groundY - player.h;

      if (!overGap && player.y >= floorY) {
        player.y = floorY;
        player.vy = 0;
        player.grounded = true;
      } else if (player.y > H + 100) {
        player.x = Math.max(0, player.x - 260);
        player.y = floorY;
        player.vy = 0;
        player.grounded = true;
        sfx.hit();
      } else {
        player.grounded = false;
      }

      if (player.invuln > 0) player.invuln -= dt;

      if (!player.grounded) {
        animFrame = FRAMES.jump;
      } else if (Math.abs(player.vx) > 1) {
        animT += dt;
        animFrame = (Math.floor(animT * 10) % 2 === 0) ? FRAMES.walk1 : FRAMES.walk2;
        if (Math.floor(animT * 10) % 2 === 0 && Math.random() < 0.2) sfx.footstep();
      } else {
        animFrame = FRAMES.idle;
      }

      coins.forEach(function (c) {
        if (c.got) return;
        c.bob += dt * 3;
        var dx = (player.x + player.w / 2) - c.x;
        var dy = (player.y + player.h / 2) - c.y;
        if (Math.sqrt(dx * dx + dy * dy) < 34) {
          c.got = true;
          coinCount++;
          ui.onCoins(coinCount);
          sfx.coin();
        }
      });

      bugs.forEach(function (b) {
        if (!b.alive) { if (b.hurt > 0) b.hurt -= dt; return; }
        b.x += b.dir * 55 * dt;
        if (b.x > b.base + b.range || b.x < b.base - b.range) b.dir *= -1;

        var px1 = player.x + 10, px2 = player.x + player.w - 10;
        var py1 = player.y + 6, py2 = player.y + player.h;
        var bx1 = b.x, bx2 = b.x + b.w, by1 = b.y, by2 = b.y + b.h;
        var overlap = px1 < bx2 && px2 > bx1 && py1 < by2 && py2 > by1;

        if (overlap && player.invuln <= 0) {
          var stomping = player.vy > 80 && (player.y + player.h) - by1 < 22;
          if (stomping) {
            b.alive = false;
            b.hurt = 0.01;
            player.vy = -420;
            coinCount += 1;
            ui.onCoins(coinCount);
            sfx.stomp();
          } else {
            player.invuln = 1.1;
            player.vx = -player.facing * 180;
            player.x += player.facing * -30;
            sfx.hit();
          }
        }
      });

      if (player.x > flagX - 20) {
        state = STATE.WIN;
        winT = 0;
        animFrame = FRAMES.win;
        stopBgLoop();
        sfx.fanfare(true);
        if (window.gtag) gtag('event', 'easter_egg_win', { coins_collected: coinCount });
        setTimeout(function () {
          var closeFn = ui.close;
          var el = document.querySelector('.ofer-game-winbar');
          if (el) return;
          document.querySelectorAll('.ofer-touch').forEach(function (t) { t.style.display = 'none'; });
          var bar = document.createElement('div');
          bar.className = 'ofer-game-winbar';
          bar.innerHTML = '<span>' + coinCount + ' collected. shipped it. &#127881;</span>' +
            '<button class="ofer-game-btn ofer-game-cta">close</button>';
          bar.querySelector('button').addEventListener('click', closeFn);
          document.querySelector('.ofer-game-stage').appendChild(bar);
        }, 900);
      }

      var targetCam = player.x - 260;
      camX += (Math.max(0, Math.min(levelWidth - W, targetCam)) - camX) * Math.min(1, dt * 6);
    }

    function keys() {
      for (var i = 0; i < arguments.length; i++) {
        if (ui.keys[arguments[i]]) return true;
      }
      return false;
    }

    function draw() {
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, sky1);
      g.addColorStop(1, sky2);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = accentLight;
      for (var c = 0; c < 5; c++) {
        var cx = ((c * 260 - camX * 0.3) % (W + 200) + (W + 200)) % (W + 200) - 100;
        ctx.beginPath();
        ctx.ellipse(cx, 60 + (c % 3) * 20, 46, 16, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.save();
      ctx.translate(-camX, 0);

      ctx.strokeStyle = accent;
      ctx.lineWidth = 4;
      ctx.beginPath();
      var gx = 0;
      var segStart = 0;
      for (var i = 0; i <= gaps.length; i++) {
        var gapStart = i < gaps.length ? gaps[i].x : levelWidth;
        ctx.moveTo(segStart, groundY);
        ctx.lineTo(gapStart, groundY);
        segStart = i < gaps.length ? gaps[i].x + gaps[i].w : levelWidth;
      }
      ctx.stroke();

      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 2;
      for (var seg = 0; seg <= gaps.length; seg++) {
        var s0 = seg === 0 ? 0 : gaps[seg - 1].x + gaps[seg - 1].w;
        var s1 = seg < gaps.length ? gaps[seg].x : levelWidth;
        for (var tx = s0 + 20; tx < s1; tx += 40) {
          ctx.beginPath();
          ctx.moveTo(tx, groundY + 8);
          ctx.lineTo(tx, groundY + 16);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      coins.forEach(function (co) {
        if (co.got) return;
        var by = co.y + Math.sin(co.bob) * 6;
        var grad = ctx.createRadialGradient(co.x - 4, by - 4, 2, co.x, by, co.r);
        grad.addColorStop(0, accentLight);
        grad.addColorStop(1, accent);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(co.x, by, co.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isDark ? '#0c2318' : '#0a4a32';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(co.x - 8, by);
        ctx.lineTo(co.x - 3, by);
        ctx.lineTo(co.x, by - 7);
        ctx.lineTo(co.x + 3, by + 7);
        ctx.lineTo(co.x + 8, by);
        ctx.stroke();
      });

      bugs.forEach(function (b) {
        if (!b.alive) return;
        ctx.save();
        if (b.dir < 0) {
          ctx.translate(b.x + b.w, b.y);
          ctx.scale(-1, 1);
          ctx.drawImage(bugImg, 0, 0, b.w, b.h);
        } else {
          ctx.drawImage(bugImg, b.x, b.y, b.w, b.h);
        }
        ctx.restore();
      });

      var flagH = 96, flagW = flagH * (flagImg.width / flagImg.height);
      ctx.drawImage(flagImg, flagX, groundY - flagH, flagW, flagH);

      var flicker = player.invuln > 0 && Math.floor(player.invuln * 20) % 2 === 0;
      if (!flicker) {
        ctx.save();
        var px = player.x, py = player.y;
        if (player.facing < 0) {
          ctx.translate(px + player.w, py);
          ctx.scale(-1, 1);
          ctx.drawImage(sheet, animFrame * FRAME_W, 0, FRAME_W, FRAME_H, 0, 0, player.w, player.h);
        } else {
          ctx.drawImage(sheet, animFrame * FRAME_W, 0, FRAME_W, FRAME_H, px, py, player.w, player.h);
        }
        ctx.restore();
      }

      particles.forEach(function (p) {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 6, 6);
        ctx.globalAlpha = 1;
      });

      ctx.restore();
    }

    requestAnimationFrame(frame);
  }

  window.__oferGame = { start: start };
})();
