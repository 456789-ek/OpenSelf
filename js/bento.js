(function () {
  "use strict";

  var section = document.querySelector(".bento-section");
  if (!section) return;

  var settings = {
    textAutoHide: true,
    enableStars: true,
    enableSpotlight: true,
    enableBorderGlow: true,
    enableTilt: false,
    enableMagnetism: false,
    clickEffect: true,
    spotlightRadius: 400,
    particleCount: 12,
    glowColor: "146, 126, 255"
  };

  var reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var cards = Array.prototype.slice.call(section.querySelectorAll(".magic-bento-card"));
  var spotlight = null;

  section.setAttribute("data-bento-tilt", settings.enableTilt ? "true" : "false");
  section.setAttribute("data-bento-magnet", settings.enableMagnetism ? "true" : "false");
  section.setAttribute("data-spotlight-radius", String(settings.spotlightRadius));
  section.setAttribute("data-particle-count", String(settings.particleCount));
  section.setAttribute("data-glow-color", settings.glowColor);

  function reduced() {
    return reduceQuery.matches;
  }

  cards.forEach(function (card) {
    card.classList.toggle("magic-bento-card--text-autohide", settings.textAutoHide);
    card.classList.toggle("magic-bento-card--border-glow", settings.enableBorderGlow);
    card.classList.toggle("particle-container", settings.enableStars);
    card.style.setProperty("--glow-color", settings.glowColor);
    card.style.setProperty("--glow-radius", settings.spotlightRadius + "px");
  });

  function spotlightMetrics(radius) {
    return {
      proximity: radius * 0.5,
      fadeDistance: radius * 0.75
    };
  }

  function ensureSpots(card) {
    if (card._starSpots && card._starSpots.length === settings.particleCount) return;
    card._starSpots = [];
    var i;
    for (i = 0; i < settings.particleCount; i += 1) {
      card._starSpots.push({ x: Math.random(), y: Math.random() });
    }
  }

  function clearStars(card) {
    card._starsOn = false;
    (card._starTimers || []).forEach(function (timer) {
      window.clearTimeout(timer);
    });
    card._starTimers = [];
    Array.prototype.forEach.call(card.querySelectorAll(".bento-star"), function (star) {
      if (star._leaving) return;
      star._leaving = true;
      if (star._drift) star._drift.cancel();
      var fade = star.animate(
        [
          { opacity: 1, transform: "scale(1)" },
          { opacity: 0, transform: "scale(0)" }
        ],
        { duration: 280, easing: "cubic-bezier(0.6, -0.3, 0.74, 0.05)", fill: "forwards" }
      );
      fade.onfinish = function () {
        star.remove();
      };
    });
  }

  function showStars(card) {
    if (!settings.enableStars || reduced() || card._starsOn) return;
    card._starsOn = true;
    ensureSpots(card);
    card._starTimers = [];
    card._starSpots.forEach(function (spot, index) {
      var timer = window.setTimeout(function () {
        if (!card._starsOn) return;
        var rect = card.getBoundingClientRect();
        var star = document.createElement("span");
        star.className = "bento-star";
        star.style.left = spot.x * rect.width + "px";
        star.style.top = spot.y * rect.height + "px";
        card.appendChild(star);
        var dx = (Math.random() - 0.5) * 100;
        var dy = (Math.random() - 0.5) * 100;
        var rot = Math.random() * 360;
        var intro = star.animate(
          [
            { transform: "translate(0px, 0px) scale(0) rotate(0deg)", opacity: 0 },
            { transform: "translate(0px, 0px) scale(1) rotate(0deg)", opacity: 1 }
          ],
          { duration: 300, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)", fill: "forwards" }
        );
        intro.onfinish = function () {
          if (!card._starsOn || !star.isConnected) return;
          star._drift = star.animate(
            [
              { transform: "translate(0px, 0px) rotate(0deg)", opacity: 1 },
              {
                transform: "translate(" + dx + "px, " + dy + "px) rotate(" + rot + "deg)",
                opacity: 0.3
              }
            ],
            {
              duration: 2000 + Math.random() * 2000,
              easing: "linear",
              iterations: Infinity,
              direction: "alternate"
            }
          );
        };
      }, index * 100);
      card._starTimers.push(timer);
    });
  }

  function ripple(card, event) {
    if (!settings.clickEffect || reduced()) return;
    var rect = card.getBoundingClientRect();
    var x = event.clientX - rect.left;
    var y = event.clientY - rect.top;
    if (!event.clientX && !event.clientY) {
      x = rect.width / 2;
      y = rect.height / 2;
    }
    var maxDistance = Math.max(
      Math.hypot(x, y),
      Math.hypot(x - rect.width, y),
      Math.hypot(x, y - rect.height),
      Math.hypot(x - rect.width, y - rect.height)
    );
    var el = document.createElement("span");
    el.className = "bento-ripple";
    el.style.width = maxDistance * 2 + "px";
    el.style.height = maxDistance * 2 + "px";
    el.style.left = x - maxDistance + "px";
    el.style.top = y - maxDistance + "px";
    card.appendChild(el);
    var anim = el.animate(
      [
        { transform: "scale(0)", opacity: 1 },
        { transform: "scale(1)", opacity: 0 }
      ],
      { duration: 800, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)", fill: "forwards" }
    );
    anim.onfinish = function () {
      el.remove();
    };
  }

  function glowAt(card, clientX, clientY, amount) {
    var rect = card.getBoundingClientRect();
    var relativeX = rect.width ? ((clientX - rect.left) / rect.width) * 100 : 50;
    var relativeY = rect.height ? ((clientY - rect.top) / rect.height) * 100 : 50;
    card.style.setProperty("--glow-x", relativeX + "%");
    card.style.setProperty("--glow-y", relativeY + "%");
    card.style.setProperty("--glow-intensity", String(amount));
    card.style.setProperty("--glow-radius", settings.spotlightRadius + "px");
  }

  function bindCard(card) {
    card.addEventListener("pointerenter", function (event) {
      showStars(card);
      if (!reduced() && settings.enableBorderGlow) glowAt(card, event.clientX, event.clientY, 1);
    });
    card.addEventListener("pointerleave", function () {
      clearStars(card);
    });
    card.addEventListener("focus", function () {
      showStars(card);
      if (!reduced() && settings.enableBorderGlow) {
        var rect = card.getBoundingClientRect();
        glowAt(card, rect.left + rect.width / 2, rect.top + rect.height / 2, 1);
      }
    });
    card.addEventListener("blur", function () {
      clearStars(card);
      card.style.setProperty("--glow-intensity", "0");
    });
    card.addEventListener("click", function (event) {
      ripple(card, event);
    });
  }

  cards.forEach(bindCard);

  function mountSpotlight() {
    if (!settings.enableSpotlight || reduced()) return;
    spotlight = document.createElement("div");
    spotlight.className = "global-spotlight";
    spotlight.style.background =
      "radial-gradient(circle, rgba(" +
      settings.glowColor +
      ", 0.15) 0%, rgba(" +
      settings.glowColor +
      ", 0.08) 15%, rgba(" +
      settings.glowColor +
      ", 0.04) 25%, rgba(" +
      settings.glowColor +
      ", 0.02) 40%, rgba(" +
      settings.glowColor +
      ", 0.01) 65%, transparent 70%)";
    document.body.appendChild(spotlight);

    document.addEventListener("pointermove", function (event) {
      if (!spotlight || reduced()) return;
      var bounds = section.getBoundingClientRect();
      var inside =
        event.clientX >= bounds.left &&
        event.clientX <= bounds.right &&
        event.clientY >= bounds.top &&
        event.clientY <= bounds.bottom;
      if (!inside) {
        spotlight.style.opacity = "0";
        cards.forEach(function (card) {
          card.style.setProperty("--glow-intensity", "0");
        });
        return;
      }

      var metrics = spotlightMetrics(settings.spotlightRadius);
      var minDistance = Infinity;
      cards.forEach(function (card) {
        var rect = card.getBoundingClientRect();
        var centerX = rect.left + rect.width / 2;
        var centerY = rect.top + rect.height / 2;
        var distance =
          Math.hypot(event.clientX - centerX, event.clientY - centerY) -
          Math.max(rect.width, rect.height) / 2;
        var effective = Math.max(0, distance);
        if (effective < minDistance) minDistance = effective;
        var amount = 0;
        if (effective <= metrics.proximity) amount = 1;
        else if (effective <= metrics.fadeDistance) {
          amount = (metrics.fadeDistance - effective) / (metrics.fadeDistance - metrics.proximity);
        }
        if (settings.enableBorderGlow) glowAt(card, event.clientX, event.clientY, amount);
      });

      spotlight.style.left = event.clientX + "px";
      spotlight.style.top = event.clientY + "px";
      var target =
        minDistance <= metrics.proximity
          ? 0.8
          : minDistance <= metrics.fadeDistance
            ? ((metrics.fadeDistance - minDistance) / (metrics.fadeDistance - metrics.proximity)) * 0.8
            : 0;
      spotlight.style.opacity = String(target);
    });

    document.documentElement.addEventListener("pointerleave", function () {
      if (!spotlight) return;
      spotlight.style.opacity = "0";
      cards.forEach(function (card) {
        card.style.setProperty("--glow-intensity", "0");
      });
    });
  }

  mountSpotlight();

  if (reduceQuery.addEventListener) {
    reduceQuery.addEventListener("change", function () {
      if (!reduced()) return;
      if (spotlight) {
        spotlight.remove();
        spotlight = null;
      }
      cards.forEach(function (card) {
        clearStars(card);
        card.style.setProperty("--glow-intensity", "0");
      });
    });
  }
})();
