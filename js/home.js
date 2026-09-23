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
    "projects.html": true
  };

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
    if (reduced() || crossDocTurn) {
      root.classList.remove("is-leaving");
      return;
    }
    root.classList.remove("is-arriving");
    void root.offsetWidth;
    root.classList.add("is-arriving");
    root.classList.remove("is-leaving");
  });

  document.addEventListener("click", function (event) {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (reduced() || crossDocTurn) return;
    var link = event.target;
    while (link && link !== document && link.tagName !== "A") link = link.parentNode;
    if (!crossPageLink(link)) return;
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
