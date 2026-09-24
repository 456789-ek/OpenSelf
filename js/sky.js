/* Cinematic nebula sky for the Openself homepage.
   Heavy paint work (nebula clouds, starfields) is baked once into
   offscreen canvases; every frame only composites those layers with
   slow drift and pointer parallax, then adds the live elements:
   twinkling halo stars, aurora ribbons, shooting stars and a pointer
   trail. prefers-reduced-motion collapses everything to one still paint. */
(function () {
  "use strict";

  var canvas = document.getElementById("night-sky");
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;

  var reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var fineQuery = window.matchMedia("(pointer: fine)");

  var PAD = 100;
  var VPAD = 64;
  var PIXEL_BUDGET = 5.6e6;

  var width = 0;
  var height = 0;
  var maxShift = 40;
  var angle = -0.16;
  var cosA = 1;
  var sinA = 0;
  var bandCX = 0;
  var bandCY = 0;
  var coreAlong = 0;
  var bandSigma = 120;

  /* River flow, in px/s. Slow, but clearly visible within seconds. */
  var FLOW_FAR = 5;
  var FLOW_NEAR = 9.5;

  var base = null;
  var nebulaFar = null;
  var nebulaNear = null;
  var tiles = [];
  var lanes = [];
  var sparks = [];
  var ribbons = [];
  var meteors = [];
  var nextMeteor = 0;
  var trail = [];

  var haloWarm = null;
  var haloCool = null;
  var glowSoft = null;

  var frame = 0;
  var running = false;
  var aimX = 0;
  var aimY = 0;
  var parX = 0;
  var parY = 0;
  var pointerX = -1e4;
  var pointerY = -1e4;
  var pointerOn = false;
  var resizeTimer = 0;

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
    var g = Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
    return clamp(g, -2.5, 2.5);
  }

  /* Band coordinates: along/across the tilted galactic axis, whose
     centerline crosses the middle of the viewport. */
  function bandPoint(along, across) {
    var wave = Math.sin(along * 0.0011) * bandSigma * 0.25;
    var a = across + wave;
    return {
      x: bandCX + along * cosA - a * sinA,
      y: bandCY + along * sinA + a * cosA
    };
  }

  function inClearing(x, y) {
    var nx = (x - width * 0.5) / (width * 0.32);
    var ny = (y - height * 0.55) / (height * 0.3);
    return nx * nx + ny * ny < 1;
  }

  function makeSprite(size, inner, mid, midStop) {
    var c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    var g2 = c.getContext("2d");
    var half = size / 2;
    var g = g2.createRadialGradient(half, half, 0, half, half, half);
    g.addColorStop(0, inner);
    g.addColorStop(midStop, mid);
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
    g2.fillStyle = g;
    g2.fillRect(0, 0, size, size);
    return c;
  }

  /* One soft elliptical cloud puff on a bake context, repeated at
     tile-width offsets so the layer wraps horizontally without a seam. */
  function puff(g2, x, y, r, squash, rot, color, alpha) {
    if (r < 2) return;
    var tw = g2.canvas.width;
    var wrap;
    for (wrap = -1; wrap <= 1; wrap += 1) {
      var wx = x + wrap * tw;
      if (wx + r * 1.2 < 0 || wx - r * 1.2 > tw) continue;
      g2.save();
      g2.translate(wx, y);
      g2.rotate(rot);
      g2.scale(1, squash);
      var g = g2.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, "rgba(" + color + ", " + alpha.toFixed(4) + ")");
      g.addColorStop(0.55, "rgba(" + color + ", " + (alpha * 0.42).toFixed(4) + ")");
      g.addColorStop(1, "rgba(" + color + ", 0)");
      g2.fillStyle = g;
      g2.beginPath();
      g2.arc(0, 0, r, 0, Math.PI * 2);
      g2.fill();
      g2.restore();
    }
  }

  /* A cluster of puffs around a center: the "volumetric" cloud look. */
  function cloud(g2, rng, cx, cy, baseR, color, alpha, kids) {
    puff(g2, cx, cy, baseR, 0.55 + rng() * 0.35, angle + (rng() - 0.5) * 0.7, color, alpha);
    var i;
    for (i = 0; i < kids; i += 1) {
      var dist = baseR * (0.2 + rng() * 0.75);
      var dir = rng() * Math.PI * 2;
      puff(
        g2,
        cx + Math.cos(dir) * dist,
        cy + Math.sin(dir) * dist * 0.7,
        baseR * (0.24 + rng() * 0.4),
        0.5 + rng() * 0.4,
        rng() * Math.PI,
        color,
        alpha * (0.5 + rng() * 0.7)
      );
    }
  }

  function bakeBase() {
    var c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    var g2 = c.getContext("2d");
    var sky = g2.createLinearGradient(0, 0, width * 0.2, height);
    sky.addColorStop(0, "#05071a");
    sky.addColorStop(0.45, "#070a1e");
    sky.addColorStop(1, "#0a0d22");
    g2.fillStyle = sky;
    g2.fillRect(0, 0, width, height);

    var corner = g2.createRadialGradient(width * 0.06, 0, 0, width * 0.06, 0, Math.max(width, height));
    corner.addColorStop(0, "rgba(44, 40, 110, 0.18)");
    corner.addColorStop(0.5, "rgba(24, 26, 70, 0.06)");
    corner.addColorStop(1, "rgba(8, 10, 26, 0)");
    g2.fillStyle = corner;
    g2.fillRect(0, 0, width, height);

    var floor = g2.createLinearGradient(0, height * 0.72, 0, height);
    floor.addColorStop(0, "rgba(10, 8, 30, 0)");
    floor.addColorStop(1, "rgba(14, 9, 36, 0.22)");
    g2.fillStyle = floor;
    g2.fillRect(0, height * 0.7, width, height * 0.3);
    return c;
  }

  /* Nebula layers are baked at half resolution as horizontally wrapping
     tiles (with PAD vertical overscan), so the whole river can flow
     sideways forever without a seam. */
  function nebulaCanvas() {
    var c = document.createElement("canvas");
    c.width = Math.max(2, Math.round(width / 2));
    c.height = Math.max(2, Math.round((height + PAD * 2) / 2));
    return c;
  }

  function toNeb(c, x, y) {
    var wrapped = ((x % width) + width) % width;
    return { x: wrapped * 0.5, y: (y + PAD) * 0.5, s: 0.5 };
  }

  function bakeNebulaFar(rng) {
    var c = nebulaCanvas();
    var g2 = c.getContext("2d");
    g2.globalCompositeOperation = "lighter";
    var reach = Math.hypot(width, height);
    var along;
    for (along = -reach * 0.9; along <= reach * 0.9; along += bandSigma * (0.55 + rng() * 0.35)) {
      var across = gaussian(rng) * bandSigma * 0.55;
      var p = bandPoint(along, across);
      var n = toNeb(c, p.x, p.y);
      var deep = rng() < 0.4;
      cloud(
        g2,
        rng,
        n.x,
        n.y,
        (bandSigma * (1.1 + rng() * 1.2)) * n.s,
        deep ? "36, 46, 124" : "54, 48, 140",
        0.05 + rng() * 0.035,
        5
      );
    }
    var i;
    for (i = 0; i < 10; i += 1) {
      var p2 = bandPoint((i / 10 - 0.5) * reach * 1.8 + rng() * bandSigma, (rng() - 0.5) * bandSigma * 3.2);
      var n2 = toNeb(c, p2.x, p2.y);
      cloud(g2, rng, n2.x, n2.y, bandSigma * (0.8 + rng() * 0.8) * n2.s, "72, 54, 156", 0.03 + rng() * 0.022, 4);
    }
    return c;
  }

  function bakeNebulaNear(rng) {
    var c = nebulaCanvas();
    var g2 = c.getContext("2d");
    g2.globalCompositeOperation = "lighter";
    var reach = Math.hypot(width, height);

    /* Continuous glow ribbon: elongated puffs along the centerline make
       the band read as one river instead of separate clouds. */
    var along;
    for (along = -reach * 0.95; along <= reach * 0.95; along += bandSigma * 0.5) {
      var pr = bandPoint(along + (rng() - 0.5) * bandSigma * 0.2, (rng() - 0.5) * bandSigma * 0.25);
      var nr = toNeb(c, pr.x, pr.y);
      puff(g2, nr.x, nr.y, bandSigma * (0.75 + rng() * 0.35) * nr.s, 0.45, angle, "104, 100, 200", 0.045);
    }

    /* Warm heart of the galaxy. */
    var heart = bandPoint(coreAlong, 0);
    var hn = toNeb(c, heart.x, heart.y);
    cloud(g2, rng, hn.x, hn.y, bandSigma * 1.5 * hn.s, "150, 100, 92", 0.09, 6);
    cloud(g2, rng, hn.x, hn.y, bandSigma * 0.8 * hn.s, "226, 154, 98", 0.14, 5);
    cloud(g2, rng, hn.x, hn.y, bandSigma * 0.42 * hn.s, "255, 204, 140", 0.22, 3);
    puff(g2, hn.x, hn.y, bandSigma * 0.2 * hn.s, 0.75, angle, "255, 234, 194", 0.38);

    /* Violet and magenta shoulders along the whole band. */
    var i;
    for (i = 0; i < 12; i += 1) {
      var shoulder = (i / 11 - 0.5) * reach * 1.8 + (rng() - 0.5) * bandSigma;
      var across = gaussian(rng) * bandSigma * 0.45;
      var p = bandPoint(shoulder, across);
      var n = toNeb(c, p.x, p.y);
      var magenta = rng() < 0.35;
      cloud(
        g2,
        rng,
        n.x,
        n.y,
        bandSigma * (0.6 + rng() * 0.8) * n.s,
        magenta ? "152, 70, 176" : "106, 68, 200",
        0.05 + rng() * 0.035,
        5
      );
    }

    /* A few cold teal wisps for range. */
    for (i = 0; i < 3; i += 1) {
      var p3 = bandPoint((rng() - 0.2) * reach, (0.9 + rng() * 1.4) * bandSigma * (rng() < 0.5 ? -1 : 1));
      var n3 = toNeb(c, p3.x, p3.y);
      cloud(g2, rng, n3.x, n3.y, bandSigma * (0.5 + rng() * 0.5) * n3.s, "58, 140, 160", 0.035, 4);
    }
    return c;
  }

  function bakeLanes(rng) {
    lanes = [];
    var reach = Math.hypot(width, height);
    var specs = [
      { da: -0.55, dc: 0.1, len: 1, thick: 0.2, alpha: 0.4 },
      { da: 0.05, dc: -0.14, len: 1.3, thick: 0.16, alpha: 0.34 },
      { da: 0.6, dc: 0.16, len: 0.85, thick: 0.15, alpha: 0.28 }
    ];
    var i;
    for (i = 0; i < specs.length; i += 1) {
      var s = specs[i];
      lanes.push({
        along: s.da * reach * 0.8 + (rng() - 0.5) * bandSigma * 0.4,
        across: s.dc * bandSigma * 2,
        rx: reach * 0.22 * s.len,
        ry: Math.max(14, bandSigma * s.thick),
        tilt: (rng() - 0.5) * 0.2,
        alpha: s.alpha
      });
    }
  }

  function starTint(rng) {
    var pick = rng();
    if (pick < 0.12) return "255, 224, 186";
    if (pick < 0.3) return "196, 198, 240";
    return "218, 228, 248";
  }

  function bakeTile(rng, count, opts) {
    var c = document.createElement("canvas");
    var w = Math.max(2, width);
    var h = Math.max(2, height + VPAD * 2);
    c.width = w;
    c.height = h;
    var g2 = c.getContext("2d");
    var reach = Math.hypot(width, height);
    var i;
    for (i = 0; i < count; i += 1) {
      var x;
      var y;
      if (opts.bandBias && rng() < opts.bandBias) {
        var p = bandPoint((rng() - 0.5) * reach * 2.2, gaussian(rng) * bandSigma * 0.85);
        x = ((p.x % w) + w) % w;
        y = clamp(p.y + VPAD, 0, h);
      } else {
        x = rng() * w;
        y = rng() * h;
      }
      var r = opts.rMin + rng() * (opts.rMax - opts.rMin);
      var alpha = opts.aMin + rng() * (opts.aMax - opts.aMin);
      g2.globalAlpha = alpha;
      g2.fillStyle = "rgb(" + starTint(rng) + ")";
      var wrap;
      for (wrap = -1; wrap <= 1; wrap += 1) {
        var wx = x + wrap * w;
        if (wx < -4 || wx > w + 4) continue;
        if (r < 0.75) {
          g2.fillRect(wx - r, y - r, r * 2, r * 2);
        } else {
          g2.beginPath();
          g2.arc(wx, y, r, 0, Math.PI * 2);
          g2.fill();
        }
      }
    }
    g2.globalAlpha = 1;
    return c;
  }

  function bakeRibbon(color) {
    var c = document.createElement("canvas");
    c.width = Math.max(2, width);
    c.height = 110;
    var g2 = c.getContext("2d");
    var vertical = g2.createLinearGradient(0, 0, 0, c.height);
    vertical.addColorStop(0, "rgba(" + color + ", 0)");
    vertical.addColorStop(0.45, "rgba(" + color + ", 1)");
    vertical.addColorStop(1, "rgba(" + color + ", 0)");
    g2.fillStyle = vertical;
    g2.fillRect(0, 0, c.width, c.height);
    var ends = g2.createLinearGradient(0, 0, c.width, 0);
    ends.addColorStop(0, "rgba(0, 0, 0, 0)");
    ends.addColorStop(0.18, "rgba(0, 0, 0, 1)");
    ends.addColorStop(0.82, "rgba(0, 0, 0, 1)");
    ends.addColorStop(1, "rgba(0, 0, 0, 0)");
    g2.globalCompositeOperation = "destination-in";
    g2.fillStyle = ends;
    g2.fillRect(0, 0, c.width, c.height);
    return c;
  }

  function bakeSparks(rng) {
    sparks = [];
    var count = clamp(Math.round((width * height) / 82000), 14, 26);
    var guard = 0;
    while (sparks.length < count && guard < 600) {
      guard += 1;
      var x = rng() * width;
      var y = rng() * height;
      if (inClearing(x, y) && rng() < 0.75) continue;
      var giant = sparks.length < 4;
      var warm = rng() < 0.3;
      sparks.push({
        x: x,
        y: y,
        r: giant ? 1.5 + rng() * 0.8 : 0.9 + rng() * 0.7,
        halo: giant ? 46 + rng() * 40 : 14 + rng() * 20,
        warm: warm,
        tw: 0.35 + rng() * 0.9,
        pulse: 0.12 + rng() * 0.35,
        phase: rng() * Math.PI * 2
      });
    }
  }

  function build() {
    var rect = canvas.parentElement.getBoundingClientRect();
    width = Math.max(1, Math.floor(rect.width));
    height = Math.max(1, Math.floor(rect.height));
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (width * height * dpr * dpr > PIXEL_BUDGET) {
      dpr = Math.max(1, Math.sqrt(PIXEL_BUDGET / (width * height)));
    }
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    angle = width >= height ? -0.18 : -0.3;
    cosA = Math.cos(angle);
    sinA = Math.sin(angle);
    bandCX = width * 0.5;
    bandCY = height * (width >= height ? 0.36 : 0.3);
    coreAlong = -Math.hypot(width, height) * 0.26;
    bandSigma = Math.max(120, Math.min(width, height) * (width >= height ? 0.3 : 0.42));
    maxShift = Math.min(56, Math.min(width, height) * 0.06);

    haloWarm = makeSprite(128, "rgba(255, 228, 188, 0.85)", "rgba(255, 180, 112, 0.16)", 0.22);
    haloCool = makeSprite(128, "rgba(228, 238, 255, 0.85)", "rgba(152, 172, 236, 0.15)", 0.22);
    glowSoft = makeSprite(128, "rgba(174, 152, 255, 0.4)", "rgba(120, 92, 220, 0.1)", 0.35);

    var rng = mulberry32(0x51ee7a);
    base = bakeBase();
    nebulaFar = bakeNebulaFar(rng);
    nebulaNear = bakeNebulaNear(rng);
    bakeLanes(rng);

    var area = width * height;
    tiles = [
      { canvas: bakeTile(rng, clamp(Math.round(area / 650), 1000, 2600), { rMin: 0.3, rMax: 0.7, aMin: 0.05, aMax: 0.22, bandBias: 0.42 }), speed: 3.5, depth: 0.05 },
      { canvas: bakeTile(rng, clamp(Math.round(area / 950), 800, 1900), { rMin: 0.4, rMax: 1, aMin: 0.08, aMax: 0.36, bandBias: 0.68 }), speed: 8, depth: 0.16 },
      { canvas: bakeTile(rng, clamp(Math.round(area / 2700), 260, 660), { rMin: 0.55, rMax: 1.45, aMin: 0.16, aMax: 0.5, bandBias: 0.25 }), speed: 16, depth: 0.38 }
    ];

    ribbons = [
      { sprite: bakeRibbon("96, 214, 188"), y: height * 0.08, amp: 11, wave: 0.16, phase: 0.4, alpha: 0.08 },
      { sprite: bakeRibbon("150, 116, 235"), y: height * 0.17, amp: 15, wave: 0.11, phase: 2.1, alpha: 0.1 }
    ];

    bakeSparks(rng);
    meteors = [];
    trail = [];
    nextMeteor = 0;
  }

  function drawNebula(img, t, flow, depth, alphaBase, alphaAmp, breathe, phase, swayAmp, sway) {
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = alphaBase + alphaAmp * Math.sin(t * breathe + phase);
    var ox = (((t * flow + parX * maxShift * depth) % width) + width) % width;
    var dy = -PAD + Math.sin(t * sway + phase) * swayAmp + parY * maxShift * depth;
    var dh = height + PAD * 2;
    ctx.drawImage(img, -ox, dy, width, dh);
    if (ox > 0.5) ctx.drawImage(img, width - ox, dy, width, dh);
    ctx.globalAlpha = 1;
  }

  function drawTile(tile, t) {
    ctx.globalCompositeOperation = "source-over";
    var w = tile.canvas.width;
    var ox = (((t * tile.speed + parX * maxShift * tile.depth) % w) + w) % w;
    var oy = clamp(parY * maxShift * tile.depth, -VPAD, VPAD);
    ctx.drawImage(tile.canvas, -ox, -VPAD + oy);
    if (ox > 0.5) ctx.drawImage(tile.canvas, w - ox, -VPAD + oy);
  }

  function drawLanes(t) {
    ctx.globalCompositeOperation = "source-over";
    var range = Math.hypot(width, height) * 1.8;
    var i;
    for (i = 0; i < lanes.length; i += 1) {
      var lane = lanes[i];
      var a = lane.along - t * FLOW_NEAR;
      a = (((a + range * 0.5) % range) + range) % range - range * 0.5;
      var p = bandPoint(a, lane.across);
      ctx.save();
      ctx.translate(p.x + parX * maxShift * 0.12, p.y + parY * maxShift * 0.12);
      ctx.rotate(angle + lane.tilt);
      ctx.scale(lane.rx, lane.ry);
      var g = ctx.createRadialGradient(0, 0, 0.08, 0, 0, 1);
      g.addColorStop(0, "rgba(3, 4, 12, " + lane.alpha.toFixed(3) + ")");
      g.addColorStop(0.5, "rgba(4, 5, 14, " + (lane.alpha * 0.6).toFixed(3) + ")");
      g.addColorStop(1, "rgba(4, 5, 14, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawRibbons(t, still) {
    ctx.globalCompositeOperation = "lighter";
    var slices = 26;
    var sw = width / slices;
    var i;
    var r;
    for (r = 0; r < ribbons.length; r += 1) {
      var ribbon = ribbons[r];
      for (i = 0; i < slices; i += 1) {
        var dy = still
          ? Math.sin(i * 0.5 + ribbon.phase) * ribbon.amp
          : Math.sin(i * 0.5 + t * ribbon.wave * 4 + ribbon.phase) * ribbon.amp +
            Math.sin(i * 0.21 - t * ribbon.wave * 2.6) * ribbon.amp * 0.5;
        var flicker = still ? 0.8 : 0.72 + 0.28 * Math.sin(i * 0.8 + t * 1.1 + ribbon.phase);
        ctx.globalAlpha = ribbon.alpha * flicker;
        ctx.drawImage(
          ribbon.sprite,
          i * sw,
          0,
          sw,
          ribbon.sprite.height,
          i * sw,
          ribbon.y + dy,
          sw,
          ribbon.sprite.height
        );
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawClearing() {
    ctx.globalCompositeOperation = "source-over";
    ctx.save();
    ctx.translate(width * 0.5, height * 0.5);
    ctx.scale(width * 0.46, height * 0.5);
    var g = ctx.createRadialGradient(0, 0, 0.1, 0, 0, 1);
    g.addColorStop(0, "rgba(5, 6, 18, 0.62)");
    g.addColorStop(0.45, "rgba(5, 6, 18, 0.4)");
    g.addColorStop(0.75, "rgba(5, 6, 18, 0.14)");
    g.addColorStop(1, "rgba(5, 6, 18, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawSparks(t, still) {
    var i;
    ctx.globalCompositeOperation = "lighter";
    for (i = 0; i < sparks.length; i += 1) {
      var s = sparks[i];
      var tw = still ? 0.8 : 0.62 + 0.38 * Math.sin(t * s.tw + s.phase);
      var x = s.x + parX * maxShift * 0.45;
      var y = s.y + parY * maxShift * 0.45;
      var boost = 0;
      if (pointerOn && !still) {
        var dx = pointerX - x;
        var dy = pointerY - y;
        var d = Math.hypot(dx, dy);
        if (d < 230 && d > 0.001) {
          var f = 1 - d / 230;
          boost = f;
          x += (dx / d) * f * 9;
          y += (dy / d) * f * 9;
        }
      }
      var pulse = still ? 1 : 0.86 + 0.14 * Math.sin(t * s.pulse * Math.PI * 2 + s.phase * 1.7);
      var hr = s.halo * pulse * (1 + boost * 0.6);
      ctx.globalAlpha = clamp((0.4 + 0.6 * tw) * (0.55 + boost * 0.7), 0, 1);
      ctx.drawImage(s.warm ? haloWarm : haloCool, x - hr, y - hr, hr * 2, hr * 2);
    }
    ctx.globalCompositeOperation = "source-over";
    for (i = 0; i < sparks.length; i += 1) {
      var sp = sparks[i];
      var tw2 = still ? 0.85 : 0.62 + 0.38 * Math.sin(t * sp.tw + sp.phase);
      ctx.globalAlpha = clamp(0.45 + 0.55 * tw2, 0, 1);
      ctx.fillStyle = sp.warm ? "#ffeed6" : "#f4f8ff";
      ctx.beginPath();
      ctx.arc(sp.x + parX * maxShift * 0.45, sp.y + parY * maxShift * 0.45, sp.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function spawnMeteor(t) {
    var fromLeft = Math.random() < 0.5;
    var heading = fromLeft ? 0.38 + Math.random() * 0.26 : Math.PI - 0.38 - Math.random() * 0.26;
    var speed = 620 + Math.random() * 420;
    meteors.push({
      x: width * (fromLeft ? 0.05 + Math.random() * 0.5 : 0.45 + Math.random() * 0.5),
      y: -10 + Math.random() * height * 0.4,
      vx: Math.cos(heading) * speed,
      vy: Math.sin(heading) * speed,
      len: 130 + Math.random() * 110,
      born: t,
      life: 0.9 + Math.random() * 0.5
    });
  }

  function drawMeteors(t) {
    if (t >= nextMeteor && meteors.length < 2 && !document.hidden) {
      if (nextMeteor > 0) spawnMeteor(t);
      nextMeteor = t + 4.5 + Math.random() * 6.5;
    }
    if (!meteors.length) return;
    ctx.globalCompositeOperation = "lighter";
    var alive = [];
    var i;
    for (i = 0; i < meteors.length; i += 1) {
      var m = meteors[i];
      var age = t - m.born;
      if (age > m.life) continue;
      var x = m.x + m.vx * age;
      var y = m.y + m.vy * age;
      if (y > height + 60 || x < -220 || x > width + 220) continue;
      alive.push(m);
      var fade = Math.sin(Math.PI * clamp(age / m.life, 0, 1));
      var norm = Math.hypot(m.vx, m.vy);
      var tx = x - (m.vx / norm) * m.len;
      var ty = y - (m.vy / norm) * m.len;
      var g = ctx.createLinearGradient(x, y, tx, ty);
      g.addColorStop(0, "rgba(240, 246, 255, " + (0.85 * fade).toFixed(3) + ")");
      g.addColorStop(0.3, "rgba(178, 196, 255, " + (0.34 * fade).toFixed(3) + ")");
      g.addColorStop(1, "rgba(140, 160, 255, 0)");
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.8;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      var hr = 12 * fade;
      ctx.globalAlpha = fade;
      ctx.drawImage(haloCool, x - hr, y - hr, hr * 2, hr * 2);
      ctx.globalAlpha = 1;
    }
    meteors = alive;
  }

  function drawTrail(now) {
    if (!trail.length) return;
    ctx.globalCompositeOperation = "lighter";
    var alive = [];
    var i;
    for (i = 0; i < trail.length; i += 1) {
      var dot = trail[i];
      var age = (now - dot.at) / 750;
      if (age >= 1) continue;
      alive.push(dot);
      var r = 20 + age * 30;
      ctx.globalAlpha = 0.12 * (1 - age);
      ctx.drawImage(glowSoft, dot.x - r, dot.y - r, r * 2, r * 2);
    }
    trail = alive;
    ctx.globalAlpha = 1;
  }

  function paint(now, still) {
    var t = still ? 0 : now / 1000;
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(base, 0, 0);
    drawNebula(nebulaFar, t, FLOW_FAR, 0.07, 0.92, 0.08, 0.05, 0.8, 10, 0.021);
    drawTile(tiles[0], t);
    drawNebula(nebulaNear, t, FLOW_NEAR, 0.15, 0.86, 0.14, 0.037, 2.2, 14, 0.033);
    drawTile(tiles[1], t);
    drawLanes(t);
    drawRibbons(t, still);
    drawTile(tiles[2], t);
    drawClearing();
    drawSparks(t, still);
    if (!still) {
      drawMeteors(t);
      drawTrail(now);
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  function draw(now) {
    if (!running) return;
    if (!reduceQuery.matches) {
      parX += (aimX - parX) * 0.14;
      parY += (aimY - parY) * 0.14;
    } else {
      parX = 0;
      parY = 0;
    }
    paint(now || 0, false);
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
      paint(0, true);
      return;
    }
    running = true;
    frame = window.requestAnimationFrame(draw);
  }

  function onPointer(event) {
    if (reduceQuery.matches || !fineQuery.matches) return;
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointerX = event.clientX - rect.left;
    pointerY = event.clientY - rect.top;
    pointerOn = true;
    aimX = clamp(((pointerX / rect.width) - 0.5) * 2, -1.25, 1.25);
    aimY = clamp(((pointerY / rect.height) - 0.5) * 2, -1.25, 1.25);
    var last = trail[trail.length - 1];
    var stamp = performance.now();
    if (!last || Math.hypot(pointerX - last.x, pointerY - last.y) > 14 || stamp - last.at > 90) {
      trail.push({ x: pointerX, y: pointerY, at: stamp });
      if (trail.length > 36) trail.shift();
    }
  }

  window.addEventListener("pointermove", onPointer, { passive: true });
  document.addEventListener("pointerleave", function () {
    aimX = 0;
    aimY = 0;
    pointerOn = false;
  });
  if (reduceQuery.addEventListener) reduceQuery.addEventListener("change", start);
  if (fineQuery.addEventListener) fineQuery.addEventListener("change", start);
  window.addEventListener("resize", function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(start, 140);
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) halt();
    else start();
  });
  start();
})();
