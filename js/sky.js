(function () {
  "use strict";

  var canvas = document.getElementById("night-sky");
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;

  var reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var stars = [];
  var width = 0;
  var height = 0;
  var span = 1;
  var frame = 0;
  var running = false;
  var angle = -0.46;
  var cosA = Math.cos(angle);
  var sinA = Math.sin(angle);

  function mulberry32(seed) {
    var value = seed >>> 0;
    return function () {
      value |= 0;
      value = (value + 0x6d2b79f5) | 0;
      var t = Math.imul(value ^ (value >>> 15), 1 | value);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function gaussian(rng) {
    var u = Math.max(1e-7, rng());
    var v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
  }

  function wrap(pos, size) {
    var next = pos % size;
    return next < 0 ? next + size : next;
  }

  function build() {
    var rect = canvas.parentElement.getBoundingClientRect();
    width = Math.max(1, Math.floor(rect.width));
    height = Math.max(1, Math.floor(rect.height));
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    span = Math.hypot(width, height) * 1.85;
    var rng = mulberry32(0x6a1a77);
    var area = width * height;
    var bandCount = Math.max(1400, Math.min(3400, Math.round(area / 380)));
    var fieldCount = Math.max(320, Math.min(980, Math.round(area / 1500)));
    var sigma = Math.max(54, height * 0.125);
    stars = [];

    var i;
    for (i = 0; i < bandCount; i += 1) {
      var across = gaussian(rng) * sigma;
      var core = Math.exp(-(across * across) / (2 * sigma * sigma * 0.62));
      var bright = rng() < 0.03 + core * 0.04;
      stars.push({
        along: rng() * span,
        across: across,
        layer: rng() < 0.22 ? 2 : 1,
        r: bright ? 1.2 + rng() * 0.75 : 0.32 + rng() * (0.55 + core * 0.7),
        a: Math.min(1, (bright ? 0.72 + rng() * 0.28 : 0.16 + rng() * 0.5) * (0.28 + core)),
        warm: rng() < 0.42 + core * 0.45,
        twinkle: bright,
        spike: bright && rng() < 0.65,
        phase: rng() * Math.PI * 2,
        period: 3400 + rng() * 4600
      });
    }

    for (i = 0; i < fieldCount; i += 1) {
      var brightField = i < Math.max(14, Math.round(width / 110));
      stars.push({
        along: rng() * span,
        across: (rng() - 0.5) * height * 1.55,
        layer: 0,
        r: brightField ? 1.05 + rng() * 0.5 : 0.28 + rng() * 0.5,
        a: brightField ? 0.5 + rng() * 0.4 : 0.08 + rng() * 0.22,
        warm: rng() > 0.8,
        twinkle: brightField,
        spike: brightField,
        phase: rng() * Math.PI * 2,
        period: 4200 + rng() * 5200
      });
    }
  }

  function project(along, across, drift) {
    var a = wrap(along + drift, span) - span * 0.5;
    return {
      x: width * 0.5 + a * cosA - across * sinA,
      y: height * 0.47 + a * sinA + across * cosA
    };
  }

  function onScreen(x, y, pad) {
    return x >= -pad && y >= -pad && x <= width + pad && y <= height + pad;
  }

  function paintSky() {
    var sky = ctx.createLinearGradient(0, 0, width * 0.15, height);
    sky.addColorStop(0, "#07091a");
    sky.addColorStop(0.48, "#0b1224");
    sky.addColorStop(1, "#141c33");
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);
  }

  function paintBlob(x, y, radius, flatten, inner, mid) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(1, flatten);
    var glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    glow.addColorStop(0, inner);
    glow.addColorStop(0.42, mid);
    glow.addColorStop(1, "rgba(140, 160, 200, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function paintBand(drift) {
    var step = Math.max(150, width * 0.16);
    var count = Math.ceil(span / step) + 1;
    var i;
    var reach = Math.max(width, height) * 0.42;
    for (i = 0; i < count; i += 1) {
      var point = project(i * step, 0, drift);
      if (!onScreen(point.x, point.y, reach)) continue;
      paintBlob(
        point.x,
        point.y,
        reach,
        0.3,
        "rgba(255, 246, 220, 0.42)",
        "rgba(176, 198, 236, 0.16)"
      );
    }

    var riftStep = Math.max(220, width * 0.28);
    var riftCount = Math.ceil(span / riftStep) + 1;
    for (i = 0; i < riftCount; i += 1) {
      var rift = project(i * riftStep + span * 0.08, height * 0.012, drift);
      if (!onScreen(rift.x, rift.y, width * 0.5)) continue;
      paintBlob(
        rift.x,
        rift.y,
        width * 0.42,
        0.055,
        "rgba(5, 7, 16, 0.48)",
        "rgba(5, 7, 16, 0.16)"
      );
    }
  }

  function paintStar(star, x, y, alpha) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = star.warm ? "#fff3d8" : "#e4edff";
    ctx.beginPath();
    ctx.arc(x, y, star.r, 0, Math.PI * 2);
    ctx.fill();
    if (!star.spike) return;
    ctx.globalAlpha = alpha * 0.55;
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(x - star.r * 3.4, y);
    ctx.lineTo(x + star.r * 3.4, y);
    ctx.moveTo(x, y - star.r * 3.4);
    ctx.lineTo(x, y + star.r * 3.4);
    ctx.stroke();
  }

  function paint(now) {
    var reduced = reduceQuery.matches;
    var time = reduced ? 0 : now || 0;
    var drift = reduced ? 0 : time * 0.034;
    var sway = reduced ? 0 : Math.sin(time * 0.00012) * 16;

    paintSky();
    paintBand(drift);

    var i;
    for (i = 0; i < stars.length; i += 1) {
      var star = stars[i];
      var speed = star.layer === 0 ? 0.26 : star.layer === 2 ? 1.18 : 1;
      var point = project(star.along, star.across + sway * (star.layer === 0 ? 0.25 : 1), drift * speed);
      if (!onScreen(point.x, point.y, 12)) continue;
      var alpha = star.a;
      if (star.twinkle && !reduced) {
        var wave = 0.5 + 0.5 * Math.sin((time / star.period) * Math.PI * 2 + star.phase);
        alpha *= 0.42 + 0.58 * wave;
      }
      paintStar(star, point.x, point.y, alpha);
    }
    ctx.globalAlpha = 1;
  }

  function draw(now) {
    if (!running) return;
    paint(now);
    if (!reduceQuery.matches) frame = window.requestAnimationFrame(draw);
  }

  function halt() {
    running = false;
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
  }

  function start() {
    halt();
    build();
    running = true;
    if (reduceQuery.matches) {
      paint(0);
      running = false;
      return;
    }
    frame = window.requestAnimationFrame(draw);
  }

  if (reduceQuery.addEventListener) reduceQuery.addEventListener("change", start);
  window.addEventListener("resize", start);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) halt();
    else start();
  });
  start();
})();
