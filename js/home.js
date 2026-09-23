(function () {
  "use strict";

  var root = document.documentElement;
  var reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var fineQuery = window.matchMedia("(pointer: fine)");
  var wideQuery = window.matchMedia("(min-width: 861px)");

  var header = document.querySelector("[data-header]");
  var hero = document.querySelector(".hero");
  var fan = document.querySelector("[data-fan]");
  var progress = document.querySelector("[data-progress]");
  var mark = document.querySelector("[data-mark]");
  var dialog = document.getElementById("entry");
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".site-nav a"));
  var panels = Array.prototype.slice.call(document.querySelectorAll("[data-panel]"));
  var sections = ["notes", "projects"]
    .map(function (id) {
      return document.getElementById(id);
    })
    .filter(Boolean);

  var hashLock = false;

  function reduced() {
    return reduceQuery.matches;
  }

  function motionOk() {
    return !reduced() && fineQuery.matches;
  }

  function syncFlags() {
    root.classList.toggle("reduce", reduced());
  }

  syncFlags();
  if (reduceQuery.addEventListener) {
    reduceQuery.addEventListener("change", syncFlags);
  }

  var revealNodes = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          revealObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.16 }
    );
    Array.prototype.forEach.call(revealNodes, function (node) {
      revealObserver.observe(node);
    });
  } else {
    Array.prototype.forEach.call(revealNodes, function (node) {
      node.classList.add("is-in");
    });
  }

  function onScroll() {
    var scrolled = window.scrollY || root.scrollTop || 0;
    var max = root.scrollHeight - window.innerHeight;
    if (progress) {
      progress.style.transform = "scaleX(" + (max > 0 ? scrolled / max : 0) + ")";
    }
    if (header && hero) {
      header.classList.toggle("is-solid", hero.getBoundingClientRect().bottom < 80);
    }
    var marker = scrolled + 150;
    var current = "";
    sections.forEach(function (section) {
      if (section.offsetTop <= marker) current = section.id;
    });
    navLinks.forEach(function (link) {
      var href = link.getAttribute("href") || "";
      if (href.charAt(0) !== "#") return;
      if (href === "#" + current) {
        link.setAttribute("aria-current", "true");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  if (hero) {
    hero.addEventListener("pointermove", function (event) {
      if (!motionOk()) return;
      var rect = hero.getBoundingClientRect();
      var x = ((event.clientX - rect.left) / rect.width) * 100;
      var y = ((event.clientY - rect.top) / rect.height) * 100;
      hero.style.setProperty("--gx", x.toFixed(2) + "%");
      hero.style.setProperty("--gy", y.toFixed(2) + "%");
    });
  }

  if (fan) {
    fan.addEventListener("pointermove", function (event) {
      if (!motionOk() || !wideQuery.matches) return;
      var rect = fan.getBoundingClientRect();
      var x = (event.clientX - rect.left) / rect.width - 0.5;
      var y = (event.clientY - rect.top) / rect.height - 0.5;
      fan.style.setProperty("--ry", (x * 10).toFixed(2) + "deg");
      fan.style.setProperty("--rx", (-y * 8).toFixed(2) + "deg");
    });
    fan.addEventListener("pointerleave", function () {
      fan.style.removeProperty("--ry");
      fan.style.removeProperty("--rx");
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll("[data-tilt]"), function (el) {
    el.addEventListener("pointermove", function (event) {
      if (!motionOk()) return;
      var rect = el.getBoundingClientRect();
      var x = (event.clientX - rect.left) / rect.width - 0.5;
      var y = (event.clientY - rect.top) / rect.height - 0.5;
      el.style.transform =
        "rotateX(" + (-y * 7).toFixed(2) + "deg) rotateY(" + (x * 8).toFixed(2) + "deg) translateY(-4px)";
    });
    el.addEventListener("pointerleave", function () {
      el.style.transform = "";
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll("[data-mark-source]"), function (el) {
    function show() {
      if (!mark) return;
      mark.textContent = el.getAttribute("data-mark-source") || "";
    }
    el.addEventListener("pointerenter", show);
    el.addEventListener("focus", show);
  });

  function panelById(id) {
    return panels.filter(function (panel) {
      return panel.getAttribute("data-panel") === id;
    })[0];
  }

  function showPanel(id) {
    var active = panelById(id);
    if (!active) return false;
    panels.forEach(function (panel) {
      panel.hidden = panel !== active;
    });
    var title = active.querySelector("h2");
    if (title && title.id) dialog.setAttribute("aria-labelledby", title.id);
    return true;
  }

  function openEntry(id, updateHash) {
    if (!dialog || !showPanel(id)) return;
    if (!dialog.open) dialog.showModal();
    if (updateHash && location.hash !== "#" + id) {
      hashLock = true;
      history.pushState({ entry: id }, "", "#" + id);
      hashLock = false;
    }
  }

  Array.prototype.forEach.call(document.querySelectorAll("[data-open]"), function (button) {
    button.addEventListener("click", function () {
      openEntry(button.getAttribute("data-open"), true);
    });
  });

  if (dialog) {
    var closer = dialog.querySelector("[data-close]");
    if (closer) {
      closer.addEventListener("click", function () {
        dialog.close();
      });
    }

    dialog.addEventListener("click", function (event) {
      var shell = dialog.querySelector(".entry-shell");
      if (!shell || !shell.contains(event.target)) dialog.close();
    });

    dialog.addEventListener("close", function () {
      var id = location.hash.replace(/^#/, "");
      if (panelById(id)) {
        hashLock = true;
        history.pushState({ entry: null }, "", location.pathname + location.search);
        hashLock = false;
      }
    });
  }

  function syncFromHash() {
    if (hashLock || !dialog) return;
    var id = location.hash.replace(/^#/, "");
    if (id === "notes" || id === "projects" || id === "top" || id === "") {
      if (dialog.open) dialog.close();
      return;
    }
    if (panelById(id)) openEntry(id, false);
    else if (dialog.open) dialog.close();
  }

  window.addEventListener("hashchange", syncFromHash);
  window.addEventListener("popstate", syncFromHash);

  var crossDocTurn = typeof CSSViewTransitionRule !== "undefined" &&
    typeof PageSwapEvent !== "undefined" &&
    "viewTransition" in PageSwapEvent.prototype;
  var turnPages = {
    "index.html": true,
    "notes.html": true,
    "projects.html": true,
    "awards.html": true
  };
  var zooming = false;

  function currentSection() {
    if (document.body.classList.contains("page-notes")) return "notes";
    if (document.body.classList.contains("page-projects")) return "projects";
    if (document.body.classList.contains("page-awards")) return "awards";
    return "";
  }

  function sectionCard(target) {
    if (!target) return null;
    return document.querySelector('.magic-bento-card[data-section="' + target + '"]');
  }

  function frameHero(card) {
    var heroRect = hero.getBoundingClientRect();
    var rect = card.getBoundingClientRect();
    var cx = rect.left - heroRect.left + rect.width / 2;
    var cy = rect.top - heroRect.top + rect.height / 2;
    var scale = Math.max(window.innerWidth / rect.width, window.innerHeight / rect.height) * 1.08;
    var tx = window.innerWidth / 2 - heroRect.left - scale * cx;
    var ty = window.innerHeight / 2 - heroRect.top - scale * cy;
    return "translate(" + tx.toFixed(2) + "px," + ty.toFixed(2) + "px) scale(" + scale.toFixed(4) + ")";
  }

  function finishReturn() {
    if (!hero) return;
    hero.style.transition = "";
    hero.style.transform = "";
    hero.style.transformOrigin = "";
    root.classList.remove("camera-return");
  }

  function playPullback() {
    if (!hero) return;
    var veil = hero.querySelector(".zoom-veil");
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        hero.style.transition = "transform 0.98s cubic-bezier(0.16, 1, 0.3, 1)";
        hero.style.transform = "none";
        if (veil) veil.style.opacity = "";
        function done(event) {
          if (event.target !== hero || event.propertyName !== "transform") return;
          hero.removeEventListener("transitionend", done);
          finishReturn();
        }
        hero.addEventListener("transitionend", done);
        window.setTimeout(function () {
          if (root.classList.contains("camera-return")) finishReturn();
        }, 1200);
      });
    });
  }

  function startCameraReturn() {
    if (!hero || !root.classList.contains("camera-return")) return;
    if (reduced()) {
      root.classList.remove("camera-return");
      return;
    }
    var card = sectionCard(root.getAttribute("data-camera-target") || "");
    if (!card) {
      hero.classList.add("is-framed");
      root.classList.remove("camera-return");
      return;
    }
    var veil = hero.querySelector(".zoom-veil");
    hero.style.transformOrigin = "0 0";
    hero.style.transition = "none";
    hero.style.transform = frameHero(card);
    hero.classList.add("is-framed");
    if (veil) veil.style.opacity = "1";
    void hero.offsetWidth;
    playPullback();
  }

  function rememberCamera(payload) {
    try {
      sessionStorage.setItem("openself-camera", JSON.stringify(payload));
      sessionStorage.setItem("openself-skip-vt", "1");
    } catch (err) {}
  }

  function zoomInto(card, href, section) {
    if (zooming || !hero) {
      window.location.href = href;
      return;
    }
    zooming = true;
    root.classList.add("is-zooming");
    hero.style.transformOrigin = "0 0";
    hero.style.transition = "none";
    hero.style.transform = "none";
    void hero.offsetWidth;
    hero.style.transition = "transform 0.92s cubic-bezier(0.65, 0, 0.35, 1)";
    hero.style.transform = frameHero(card);
    var gone = false;
    function go() {
      if (gone) return;
      gone = true;
      rememberCamera({ mode: "arrive", target: section });
      window.location.href = href;
    }
    function onEnd(event) {
      if (event.target !== hero || event.propertyName !== "transform") return;
      hero.removeEventListener("transitionend", onEnd);
      go();
    }
    hero.addEventListener("transitionend", onEnd);
    window.setTimeout(go, 1200);
  }

  function zoomBack(href) {
    if (zooming) return;
    zooming = true;
    rememberCamera({ mode: "return", target: currentSection() });
    window.location.href = href;
  }

  startCameraReturn();

  window.addEventListener("pageswap", function (event) {
    var skip = false;
    try {
      skip = sessionStorage.getItem("openself-skip-vt") === "1";
      if (skip) sessionStorage.removeItem("openself-skip-vt");
    } catch (err) {}
    if (skip && event.viewTransition && typeof event.viewTransition.skipTransition === "function") {
      event.viewTransition.skipTransition();
    }
  });

  function pageFile(pathname) {
    var parts = (pathname || "").split("/");
    var last = parts[parts.length - 1];
    return last || "index.html";
  }

  function crossPageLink(link) {
    if (!link || link.tagName !== "A") return false;
    if (link.target && link.target !== "_self") return false;
    if (link.hasAttribute("download")) return false;
    var raw = link.getAttribute("href");
    if (!raw || raw.charAt(0) === "#") return false;
    var url;
    try {
      url = new URL(link.href, location.href);
    } catch (err) {
      return false;
    }
    if (url.origin !== location.origin) return false;
    var dest = pageFile(url.pathname);
    if (!turnPages[dest]) return false;
    return dest !== pageFile(location.pathname);
  }

  function whenArrived(done) {
    if (!root.classList.contains("is-arriving")) {
      done();
      return;
    }
    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      done();
    }
    document.body.addEventListener("animationend", function (event) {
      if (event.target !== document.body || event.animationName !== "turn-in") return;
      finish();
    });
    window.setTimeout(finish, 900);
  }

  whenArrived(syncFromHash);

  window.addEventListener("pageshow", function (event) {
    if (!event.persisted) return;
    root.classList.remove("is-leaving");
    if (hero && hero.style.transform && hero.style.transform !== "none" && !reduced()) {
      root.classList.remove("is-zooming");
      var veil = hero.querySelector(".zoom-veil");
      if (veil) veil.style.opacity = "1";
      hero.style.transformOrigin = "0 0";
      window.requestAnimationFrame(function () {
        hero.style.transition = "transform 0.98s cubic-bezier(0.16, 1, 0.3, 1)";
        hero.style.transform = "none";
        if (veil) veil.style.opacity = "";
      });
      return;
    }
    root.classList.remove("is-zooming");
    if (reduced() || crossDocTurn) return;
    root.classList.remove("is-arriving");
    void root.offsetWidth;
    root.classList.add("is-arriving");
  });

  document.addEventListener("click", function (event) {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var link = event.target;
    while (link && link !== document && link.tagName !== "A") link = link.parentNode;
    if (!crossPageLink(link)) return;
    if (reduced()) return;

    var dest = pageFile(new URL(link.href, location.href).pathname);
    var card = link.closest ? link.closest(".magic-bento-card") : null;
    var onHome = document.body.classList.contains("page-home");

    if (onHome && card && hero) {
      event.preventDefault();
      zoomInto(card, link.href, card.getAttribute("data-section") || "");
      return;
    }

    if (dest === "index.html" && !onHome) {
      event.preventDefault();
      zoomBack(link.href);
      return;
    }

    if (crossDocTurn) return;

    event.preventDefault();
    var href = link.href;
    var gone = false;
    function go() {
      if (gone) return;
      gone = true;
      try {
        sessionStorage.setItem("openself-turn", "1");
      } catch (err) {}
      window.location.href = href;
    }
    root.classList.add("is-leaving");
    document.body.addEventListener("animationend", function (event) {
      if (event.target !== document.body || event.animationName !== "turn-out") return;
      go();
    });
    window.setTimeout(go, 700);
  });
})();
