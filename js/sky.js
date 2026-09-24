(function () {
  "use strict";

  var canvas = document.getElementById("night-sky");
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;

  var reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var fineQuery = window.matchMedia("(pointer: fine)");

  var stars = [];
  var lanes = [];
  var glows = [];
  var width = 0;
  var height = 0;
  var span = 1;
  var sigma = 1;
  var angle = 0.1;
  var cosA = 1;
  var sinA = 0;
  var coreAlong = 0;
  var coreAcross = 0;
  var maxShift = 36;
  var frame = 0;
  var running = false;
  var aimX = 0;
  var aimY = 0;
  var parX = 0;
  var parY = 0;

  // Core and dust take roughly twenty seconds to slide by the bright knot.
  var DRIFT = 0.008;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

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

  function gaussClamp(rng) {
    var g = gaussian(rng);
    if (g > 2.35) return 2.35;
    if (g < -2.35) return -2.35;
    return g;
  }

  function wrapCenter(pos) {
    var half = span * 0.5;
    return ((pos + half) % span + span) % span - half;
  }

  function wrapDelta(along, origin) {
    return wrapCenter(along - origin);
  }

  function centerline(along) {
    var t = (along - coreAlong) / Math.max(width, 1);
    var down = t > 0 ? t * t * sigma * 0.72 : t * sigma * 0.06;
    var wave = Math.sin(t * 5.2) * sigma * 0.1 + Math.sin(t * 2.1 + 0.6) * sigma * 0.16;
    return coreAcross + down + wave;
  }

  function localSigma(along) {
    var d = wrapDelta(along, coreAlong);
    var reach = Math.min(width, height) * 0.58;
    var bulge = Math.exp(-(d * d) / (2 * reach * reach));
    var breathe = 0.78 + 0.32 * (0.5 + 0.5 * Math.sin(d * 0.0037 + 0.6));
    return sigma * (0.82 + bulge * 0.95) * breathe;
  }

  function armLight(along) {
    var d = wrapDelta(along, coreAlong);
    var coreR = sigma * 0.85;
    var armR = Math.max(width, height) * 0.92;
    var knot = Math.exp(-(d * d) / (2 * coreR * coreR));
    var tail = Math.exp(-(d * d) / (2 * armR * armR));
    if (d < 0) tail *= 0.55;
    return Math.min(1, knot * 0.9 + tail * 0.28);
  }

  function project(along, across, drift, shiftX, shiftY) {
    var a = wrapCenter(along + drift);
    return {
      x: width * 0.5 + a * cosA - across * sinA + shiftX,
      y: height * 0.5 + a * sinA + across * cosA + shiftY
    };
  }

  function onScreen(x, y, pad) {
    return x >= -pad && y >= -pad && x <= width + pad && y <= height + pad;
  }

  function inClearing(x, y) {
    var nx = (x - width * 0.5) / (width * 0.3);
    var ny = (y - height * 0.52) / (height * 0.3);
    return nx * nx + ny * ny < 1;
  }

  function inOuter(x, y) {
    return Math.abs(x - width * 0.5) > width * 0.3 || Math.abs(y - height * 0.5) > height * 0.32;
  }

  function build() {
    var rect = canvas.parentElement.getBoundingClientRect();
    width = Math.max(1, Math.floor(rect.width));
    height = Math.max(1, Math.floor(rect.height));
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    span = Math.hypot(width, height) * 3.4;
    sigma = Math.max(96, Math.min(width, height) * (width >= height ? 0.36 : 0.46));
    angle = width >= height ? 0.055 : 0.14;
    cosA = Math.cos(angle);
    sinA = Math.sin(angle);
    maxShift = Math.min(72, Math.min(width, height) * 0.075);

    var coreX = width * (width >= height ? 0.24 : 0.3);
    var coreY = height * (width >= height ? 0.17 : 0.09);
    var dx = coreX - width * 0.5;
    var dy = coreY - height * 0.5;
    coreAlong = dx * cosA + dy * sinA;
    coreAcross = -dx * sinA + dy * cosA;

    var rng = mulberry32(0x6a1a77);
    var area = width * height;
    var fieldCount = clamp(Math.round(area / 680), 1200, 3000);
    var bandCount = clamp(Math.round(area / 300), 2000, 4800);
    stars = [];

    var i;
    for (i = 0; i < fieldCount; i += 1) {
      stars.push({
        along: (rng() - 0.5) * span,
        across: (rng() - 0.5) * span * 0.78,
        layer: 0,
        r: 0.28 + rng() * 0.5,
        a: 0.045 + rng() * 0.12,
        tint: rng() < 0.12 ? 2 : rng() < 0.18 ? 1 : 0,
        halo: 0
      });
    }

    for (i = 0; i < bandCount; i += 1) {
      var along = (rng() - 0.5) * span;
      var spread = localSigma(along);
      var across = centerline(along) + gaussClamp(rng) * spread;
      var light = armLight(along);
      var fall = Math.exp(-Math.pow((across - centerline(along)) / Math.max(spread, 1), 2) * 0.45);
      var bright = rng() < 0.004 + light * 0.012;
      var warm = rng() < 0.06 + light * 0.4;
      stars.push({
        along: along,
        across: across,
        layer: 1,
        r: bright ? 0.85 + rng() * 0.65 : 0.28 + rng() * (0.38 + light * 0.35),
        a: Math.min(0.8, bright ? 0.4 + rng() * 0.35 : (0.03 + rng() * 0.1) * (0.4 + light) * (0.32 + fall)),
        tint: warm ? 1 : rng() < 0.22 ? 2 : 0,
        halo: 0
      });
    }

    var nearCount = clamp(Math.round(Math.min(width, height) / 88), 8, 13);
    var placed = 0;
    var guard = 0;
    while (placed < nearCount && guard < 500) {
      guard += 1;
      var nearAlong = (rng() - 0.5) * span * 0.9;
      var nearAcross = (rng() - 0.5) * Math.max(width, height) * 1.05;
      var spot = project(nearAlong, nearAcross, 0, 0, 0);
      if (!onScreen(spot.x, spot.y, -8)) continue;
      if (inClearing(spot.x, spot.y)) continue;
      if (rng() < 0.55 && !inOuter(spot.x, spot.y)) continue;
      var giant = placed < 3;
      stars.push({
        along: nearAlong,
        across: nearAcross,
        layer: 2,
        r: giant ? 1.65 + rng() * 0.7 : 1.05 + rng() * 0.4,
        a: giant ? 0.94 : 0.62 + rng() * 0.22,
        tint: placed === 0 || rng() < 0.28 ? 1 : 0,
        halo: giant ? 62 + rng() * 48 : 16 + rng() * 18
      });
      placed += 1;
    }

    buildGlow();
    buildLanes();
  }

  function buildGlow() {
    glows = [];
    var reach = Math.hypot(width, height);
    var step = Math.max(120, sigma * 0.72);
    var along;
    for (along = coreAlong - reach * 0.42; along <= coreAlong + reach * 1.05; along += step) {
      var light = armLight(along);
      if (light < 0.08) continue;
      var line = centerline(along);
      var swell = 0.9 + 0.22 * Math.sin(along * 0.0022 + 0.5);
      glows.push({
        along: along,
        across: line + Math.sin(along * 0.0035) * sigma * 0.12,
        radius: sigma * (1.85 + light * 0.35) * swell,
        flatten: 0.78,
        light: 0.55 + light * 0.45,
        skirt: true
      });
      glows.push({
        along: along,
        across: line,
        radius: sigma * (1.05 + light * 0.55) * swell,
        flatten: 0.62,
        light: light,
        skirt: false
      });
    }
  }

  function buildLanes() {
    var pieces = [
      { da: 0.04, dc: 0.02, len: 0.95, thick: 0.055, alpha: 0.78, tilt: 0.7 },
      { da: 0.62, dc: -0.1, len: 1.15, thick: 0.048, alpha: 0.7, tilt: -0.04 },
      { da: 1.15, dc: 0.16, len: 0.9, thick: 0.045, alpha: 0.62, tilt: 0.07 },
      { da: -0.22, dc: 0.18, len: 0.7, thick: 0.05, alpha: 0.66, tilt: 0.18 }
    ];
    lanes = [];
    var i;
    for (i = 0; i < pieces.length; i += 1) {
      var spec = pieces[i];
      var along = coreAlong + spec.da * sigma;
      lanes.push({
        along: along,
        across: centerline(along) + spec.dc * sigma,
        rx: sigma * spec.len,
        ry: Math.max(16, sigma * spec.thick),
        tilt: spec.tilt,
        alpha: spec.alpha
      });
    }
  }

  function depthOf(layer) {
    if (layer === 2) return 1;
    if (layer === 1) return 0.24;
    return 0.06;
  }

  function driftScale(layer) {
    if (layer === 2) return 1.6;
    if (layer === 1) return 1;
    return 0.3;
  }

  function shiftOf(layer, reduced) {
    if (reduced) return { x: 0, y: 0 };
    var depth = depthOf(layer);
    return { x: parX * maxShift * depth, y: parY * maxShift * depth };
  }

  function paintSky() {
    var sky = ctx.createLinearGradient(0, 0, width * 0.15, height);
    sky.addColorStop(0, "#07091a");
    sky.addColorStop(0.5, "#080c18");
    sky.addColorStop(1, "#0a101c");
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    var indigo = ctx.createRadialGradient(
      width * 0.08,
      height * 0.02,
      0,
      width * 0.12,
      0,
      Math.max(width, height) * 0.9
    );
    indigo.addColorStop(0, "rgba(46, 42, 102, 0.16)");
    indigo.addColorStop(0.42, "rgba(22, 26, 64, 0.06)");
    indigo.addColorStop(1, "rgba(8, 10, 24, 0)");
    ctx.fillStyle = indigo;
    ctx.fillRect(0, 0, width, height);
  }

  function paintGlowBlob(blob, drift, shift) {
    var point = project(blob.along, blob.across, drift, shift.x, shift.y);
    if (!onScreen(point.x, point.y, blob.radius)) return;
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(angle);
    ctx.scale(1, blob.flatten);
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, blob.radius);
    var alpha = blob.skirt ? 0.035 + blob.light * 0.03 : 0.045 + blob.light * 0.07;
    g.addColorStop(0, "rgba(118, 126, 196, " + alpha.toFixed(3) + ")");
    g.addColorStop(0.42, "rgba(62, 70, 148, " + (alpha * 0.55).toFixed(3) + ")");
    g.addColorStop(1, "rgba(36, 40, 96, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, blob.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function paintCore(drift, shift) {
    var heart = project(coreAlong, coreAcross, drift, shift.x, shift.y);
    var radius = sigma * 1.15;
    ctx.save();
    ctx.translate(heart.x, heart.y);
    ctx.rotate(angle - 0.18);
    ctx.scale(1.2, 0.82);
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    g.addColorStop(0, "rgba(255, 220, 170, 0.58)");
    g.addColorStop(0.16, "rgba(240, 170, 100, 0.24)");
    g.addColorStop(0.42, "rgba(96, 84, 150, 0.07)");
    g.addColorStop(1, "rgba(40, 44, 100, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    var tight = project(coreAlong + sigma * 0.02, coreAcross - sigma * 0.02, drift, shift.x, shift.y);
    var tightR = sigma * 0.38;
    ctx.save();
    ctx.translate(tight.x, tight.y);
    ctx.rotate(angle);
    ctx.scale(1.05, 0.9);
    var hot = ctx.createRadialGradient(0, 0, 0, 0, 0, tightR);
    hot.addColorStop(0, "rgba(255, 198, 120, 0.42)");
    hot.addColorStop(0.4, "rgba(255, 176, 96, 0.14)");
    hot.addColorStop(1, "rgba(255, 170, 90, 0)");
    ctx.fillStyle = hot;
    ctx.beginPath();
    ctx.arc(0, 0, tightR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    var emberAlong = coreAlong + sigma * 0.55;
    var ember = project(emberAlong, centerline(emberAlong) + sigma * 0.08, drift, shift.x, shift.y);
    var emberR = sigma * 0.62;
    ctx.save();
    ctx.translate(ember.x, ember.y);
    ctx.rotate(angle + 0.12);
    ctx.scale(1.35, 0.7);
    var h = ctx.createRadialGradient(0, 0, 0, 0, 0, emberR);
    h.addColorStop(0, "rgba(255, 210, 150, 0.2)");
    h.addColorStop(0.5, "rgba(140, 110, 150, 0.05)");
    h.addColorStop(1, "rgba(50, 48, 100, 0)");
    ctx.fillStyle = h;
    ctx.beginPath();
    ctx.arc(0, 0, emberR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function paintRiver(drift, shift) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    var i;
    for (i = 0; i < glows.length; i += 1) paintGlowBlob(glows[i], drift, shift);
    paintCore(drift, shift);
    ctx.restore();
  }

  function tintOf(tint) {
    if (tint === 1) return "#f0d5b0";
    if (tint === 2) return "#c8c6ef";
    return "#d7e0f2";
  }

  function paintDot(star, x, y) {
    ctx.globalAlpha = star.a;
    ctx.fillStyle = tintOf(star.tint);
    if (star.r < 0.8) {
      ctx.fillRect(x - star.r, y - star.r, star.r * 2, star.r * 2);
      return;
    }
    ctx.beginPath();
    ctx.arc(x, y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }

  function paintField(drift, reduced) {
    ctx.globalCompositeOperation = "source-over";
    var i;
    for (i = 0; i < stars.length; i += 1) {
      var star = stars[i];
      if (star.layer === 2) continue;
      var shift = shiftOf(star.layer, reduced);
      var point = project(star.along, star.across, drift * driftScale(star.layer), shift.x, shift.y);
      if (!onScreen(point.x, point.y, 6)) continue;
      paintDot(star, point.x, point.y);
    }
    ctx.globalAlpha = 1;
  }

  function paintDust(drift, shift) {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    var i;
    for (i = 0; i < lanes.length; i += 1) {
      var lane = lanes[i];
      var point = project(lane.along, lane.across, drift, shift.x, shift.y);
      if (!onScreen(point.x, point.y, lane.rx)) continue;
      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.rotate(angle + lane.tilt);
      ctx.scale(lane.rx, Math.max(8, lane.ry));
      var g = ctx.createRadialGradient(0, 0, 0.08, 0, 0, 1);
      g.addColorStop(0, "rgba(4, 5, 12, " + lane.alpha.toFixed(3) + ")");
      g.addColorStop(0.45, "rgba(5, 6, 14, " + (lane.alpha * 0.72).toFixed(3) + ")");
      g.addColorStop(1, "rgba(5, 6, 14, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function paintNear(drift, reduced) {
    var shift = shiftOf(2, reduced);
    var drawn = [];
    var i;
    for (i = 0; i < stars.length; i += 1) {
      var star = stars[i];
      if (star.layer !== 2) continue;
      var point = project(star.along, star.across, drift * driftScale(2), shift.x, shift.y);
      if (!onScreen(point.x, point.y, star.halo)) continue;
      drawn.push({ star: star, x: point.x, y: point.y });
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (i = 0; i < drawn.length; i += 1) {
      var item = drawn[i];
      var halo = ctx.createRadialGradient(item.x, item.y, 0, item.x, item.y, item.star.halo);
      if (item.star.tint === 1) {
        halo.addColorStop(0, "rgba(255, 226, 186, 0.4)");
        halo.addColorStop(0.16, "rgba(255, 196, 130, 0.08)");
      } else {
        halo.addColorStop(0, "rgba(226, 234, 255, 0.36)");
        halo.addColorStop(0.16, "rgba(150, 168, 220, 0.07)");
      }
      halo.addColorStop(1, "rgba(160, 170, 210, 0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(item.x, item.y, item.star.halo, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.globalCompositeOperation = "source-over";
    for (i = 0; i < drawn.length; i += 1) {
      var near = drawn[i];
      ctx.globalAlpha = near.star.a;
      ctx.fillStyle = near.star.tint === 1 ? "#fff3dc" : "#f7f9ff";
      ctx.beginPath();
      ctx.arc(near.x, near.y, near.star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function paintClearing() {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.translate(width * 0.5, height * 0.52);
    ctx.scale(width * 0.4, height * 0.42);
    var g = ctx.createRadialGradient(0, 0, 0.1, 0, 0, 1);
    g.addColorStop(0, "rgba(6, 7, 16, 0.8)");
    g.addColorStop(0.4, "rgba(6, 7, 16, 0.58)");
    g.addColorStop(0.7, "rgba(6, 7, 16, 0.22)");
    g.addColorStop(1, "rgba(6, 7, 16, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function paint(now) {
    var reduced = reduceQuery.matches;
    var time = reduced ? 0 : now || 0;
    var drift = reduced ? 0 : time * DRIFT;
    var bandShift = shiftOf(1, reduced);

    paintSky();
    paintRiver(drift, bandShift);
    paintField(drift, reduced);
    paintDust(drift, bandShift);
    paintNear(drift, reduced);
    paintClearing();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  function draw(now) {
    if (!running) return;
    if (!reduceQuery.matches) {
      parX += (aimX - parX) * 0.16;
      parY += (aimY - parY) * 0.16;
    } else {
      parX = 0;
      parY = 0;
    }
    paint(now);
    frame = window.requestAnimationFrame(draw);
  }

  function halt() {
    running = false;
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
  }

  function start() {
    halt();
    build();
    if (reduceQuery.matches) {
      aimX = 0;
      aimY = 0;
      parX = 0;
      parY = 0;
      paint(0);
      return;
    }
    running = true;
    paint(0);
    frame = window.requestAnimationFrame(draw);
  }

  function onPointer(event) {
    if (reduceQuery.matches || !fineQuery.matches) return;
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var nx = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    var ny = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    aimX = clamp(nx, -1.25, 1.25);
    aimY = clamp(ny, -1.25, 1.25);
  }

  window.addEventListener("pointermove", onPointer, { passive: true });
  document.addEventListener("pointerleave", function () {
    aimX = 0;
    aimY = 0;
  });
  if (reduceQuery.addEventListener) reduceQuery.addEventListener("change", start);
  if (fineQuery.addEventListener) fineQuery.addEventListener("change", start);
  window.addEventListener("resize", start);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) halt();
    else start();
  });
  start();
})();
