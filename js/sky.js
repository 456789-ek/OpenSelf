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
  var frame = 0;

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

  function build() {
    var rect = canvas.parentElement.getBoundingClientRect();
    width = Math.max(1, Math.floor(rect.width));
    height = Math.max(1, Math.floor(rect.height));
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var rng = mulberry32(0x0e11a5);
    var count = Math.max(900, Math.min(4200, Math.round((width * height) / 300)));
    var brightCount = Math.max(12, Math.min(22, Math.round(width / 88)));
    stars = [];

    for (var i = 0; i < count; i += 1) {
      var bright = i < brightCount;
      var medium = !bright && rng() < 0.07;
      stars.push({
        x: rng() * width,
        y: rng() * height,
        r: bright ? 1.25 + rng() * 0.55 : medium ? 0.85 + rng() * 0.35 : 0.4 + rng() * 0.45,
        a: bright ? 0.62 + rng() * 0.28 : medium ? 0.28 + rng() * 0.16 : 0.1 + rng() * 0.2,
        cool: rng() > 0.78,
        twinkle: bright,
        phase: rng() * Math.PI * 2,
        period: 4800 + rng() * 3600
      });
    }
  }

  function wrap(pos, span) {
    var next = pos % span;
    return next < 0 ? next + span : next;
  }

  function wash(driftX, driftY) {
    ctx.save();
    ctx.translate(width * 0.47 + driftX, height * 0.42 + driftY);
    ctx.rotate(-0.38);
    ctx.scale(1.15, 0.26);
    var band = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(width, height) * 0.62);
    band.addColorStop(0, "rgba(232, 238, 255, 0.16)");
    band.addColorStop(0.42, "rgba(168, 196, 238, 0.07)");
    band.addColorStop(1, "rgba(168, 196, 238, 0)");
    ctx.fillStyle = band;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(width, height) * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(width * 0.66 + driftX * 0.7, height * 0.6 + driftY * 0.5);
    ctx.rotate(-0.58);
    ctx.scale(1.05, 0.16);
    var wisp = ctx.createRadialGradient(0, 0, 0, 0, 0, width * 0.38);
    wisp.addColorStop(0, "rgba(176, 206, 255, 0.07)");
    wisp.addColorStop(1, "rgba(176, 206, 255, 0)");
    ctx.fillStyle = wisp;
    ctx.beginPath();
    ctx.arc(0, 0, width * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function draw(now) {
    var reduced = reduceQuery.matches;
    var time = reduced ? 0 : now || 0;
    var driftX = reduced ? 0 : Math.sin(time * 0.00008) * 10;
    var driftY = reduced ? 0 : Math.cos(time * 0.00005) * 4;

    var sky = ctx.createLinearGradient(0, 0, width * 0.2, height);
    sky.addColorStop(0, "#07091a");
    sky.addColorStop(0.42, "#0c1428");
    sky.addColorStop(1, "#161e36");
    ctx.globalAlpha = 1;
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    var depth = ctx.createRadialGradient(
      width * 0.5,
      height * 0.42,
      height * 0.12,
      width * 0.5,
      height * 0.55,
      height * 0.9
    );
    depth.addColorStop(0, "rgba(58, 86, 148, 0.16)");
    depth.addColorStop(1, "rgba(2, 4, 12, 0.34)");
    ctx.fillStyle = depth;
    ctx.fillRect(0, 0, width, height);

    wash(driftX, driftY);

    var i;
    for (i = 0; i < stars.length; i += 1) {
      var star = stars[i];
      var alpha = star.a;
      if (star.twinkle && !reduced) {
        var wave = 0.5 + 0.5 * Math.sin((time / star.period) * Math.PI * 2 + star.phase);
        alpha = star.a * (0.42 + 0.58 * wave);
      }
      var parallax = star.twinkle ? 1 : 0.35 + (i % 7) * 0.08;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = star.cool ? "#c5d9ff" : "#f5f8ff";
      ctx.beginPath();
      ctx.arc(wrap(star.x + driftX * parallax, width), wrap(star.y + driftY * parallax, height), star.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    if (!reduced) frame = window.requestAnimationFrame(draw);
  }

  function start() {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    build();
    if (reduceQuery.matches) draw(0);
    else frame = window.requestAnimationFrame(draw);
  }

  if (reduceQuery.addEventListener) reduceQuery.addEventListener("change", start);
  window.addEventListener("resize", start);
  start();
})();
