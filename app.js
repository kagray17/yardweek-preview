(function () {
  "use strict";

  const PLANS = {
    small: { name: "Small", lot: "Up to 5,000 sq ft", weekly: 39 },
    medium: { name: "Medium", lot: "5,000–10,000 sq ft", weekly: 49 },
    large: { name: "Large", lot: "10,000–20,000 sq ft", weekly: 64 },
    custom: { name: "Custom", lot: "Over ½ acre", weekly: 89 }
  };
  const ADDON_PRICES = { edging: 8, bagging: 10 };
  const EOW_MULT = 1.25;
  const WEEKLY_VISITS = 26;
  const SERVICE_ZIPS = new Set([
    "47901", "47902", "47903", "47904", "47905", "47906", "47907",
    "47909", "47920", "47930", "47932", "47941", "47970", "47981"
  ]);
  const EMAIL_PLACEHOLDER = "hello@yardweek.com";

  const state = {
    plan: "medium",
    edging: false,
    bagging: false,
    eow: false,
    address: "",
    zip: "",
    inArea: null,
    startWeek: "",
    lastRequest: null
  };

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function extractZip(value) {
    const m = String(value || "").match(/\b(47\d{3})\b/);
    return m ? m[1] : "";
  }

  function compute() {
    const plan = PLANS[state.plan];
    const addons = (state.edging ? ADDON_PRICES.edging : 0) + (state.bagging ? ADDON_PRICES.bagging : 0);
    const visit = Math.round((plan.weekly + addons) * (state.eow ? EOW_MULT : 1));
    const visits = state.eow ? Math.round(WEEKLY_VISITS / 2) : WEEKLY_VISITS;
    return {
      plan,
      visit,
      visits,
      season: visit * visits,
      unit: state.eow ? "every other week" : "week",
      unitShort: state.eow ? "/ every other week" : "/ week"
    };
  }

  function addonList() {
    const bits = [];
    if (state.edging) bits.push("Hard edging +$8");
    if (state.bagging) bits.push("Bagging +$10");
    return bits.length ? bits.join(", ") : "None";
  }

  function money(n) {
    return "$" + n.toLocaleString("en-US");
  }

  function renderQuote() {
    const p = compute();
    const title = p.plan.name + " lot, " + (state.eow ? "every other week" : "weekly");
    const live = $("#live-price");
    if (live) {
      live.childNodes[0].nodeValue = money(p.visit);
      const unit = $("#price-unit");
      if (unit) unit.textContent = p.unitShort;
    }
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    set("receipt-title", title);
    set("r-plan", p.plan.name + " · " + money(p.plan.weekly));
    set("r-addons", addonList());
    set("r-freq", state.eow ? "Every other week" : "Every week");
    set("r-season", "About " + money(p.season));
    const fine = $("#r-fine");
    if (fine) {
      fine.textContent = (state.plan === "custom"
        ? "Custom starting price — we’ll confirm after we see the lot. "
        : "") +
        "About " + p.visits + " visits, mid-April through mid-October, weather depending. Starting price only.";
    }
    const hint = $("#book-price-hint");
    if (hint) {
      hint.textContent = "Starting price: " + money(p.visit) + " " + p.unitShort + " · about " + money(p.season) + " for the season.";
    }
    const stickySub = $("#sticky-sub");
    const stickyBtn = $("#sticky-btn");
    if (stickySub && stickyBtn) {
      stickySub.textContent = p.plan.name + " starting at " + money(p.visit) + " " + p.unitShort;
      stickyBtn.textContent = "Book " + money(p.visit);
      stickyBtn.setAttribute("href", "#book");
    }
  }

  function syncPlanButtons() {
    $$(".choice[data-plan]").forEach((btn) => {
      const on = btn.getAttribute("data-plan") === state.plan;
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    const select = $("#book-plan");
    if (select && select.value !== state.plan) select.value = state.plan;
  }

  function syncToggles() {
    $$("[data-addon], [data-book-addon]").forEach((btn) => {
      const key = btn.getAttribute("data-addon") || btn.getAttribute("data-book-addon");
      const on = !!state[key];
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function updateAreaHint() {
    const hint = $("#area-hint");
    if (!hint) return;
    if (!state.zip) {
      state.inArea = null;
      hint.className = "hint";
      hint.textContent = "We serve Lafayette, West Lafayette, and Tippecanoe County.";
      return;
    }
    state.inArea = SERVICE_ZIPS.has(state.zip);
    if (state.inArea) {
      hint.className = "hint ok";
      hint.textContent = "ZIP " + state.zip + " is on the Yard Week route.";
    } else {
      hint.className = "hint warn";
      hint.textContent = "ZIP " + state.zip + " looks outside Tippecanoe County. Send a request anyway and we’ll see if we can add you.";
    }
  }

  function firstMondays(count) {
    const weeks = [];
    const d = new Date(2027, 3, 1); // April 1, 2027
    const offset = (8 - d.getDay()) % 7;
    d.setDate(d.getDate() + offset);
    for (let i = 0; i < count; i++) {
      const copy = new Date(d);
      copy.setDate(d.getDate() + i * 7);
      weeks.push(copy);
    }
    return weeks;
  }

  function formatWeek(d) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function isoWeek(d) {
    return d.toISOString().slice(0, 10);
  }

  function buildWeeks() {
    const grid = $("#week-grid");
    if (!grid) return;
    grid.innerHTML = "";
    const weeks = firstMondays(9);
    if (!state.startWeek) state.startWeek = isoWeek(weeks[1] || weeks[0]);
    weeks.forEach((d, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice" + (isoWeek(d) === state.startWeek ? " is-on" : "");
      btn.setAttribute("aria-pressed", isoWeek(d) === state.startWeek ? "true" : "false");
      btn.innerHTML = "<b>Week of " + formatWeek(d) + "</b><span>" + (i === 0 ? "Earliest typical start" : "Monday start") + "</span>";
      btn.addEventListener("click", () => {
        state.startWeek = isoWeek(d);
        buildWeeks();
      });
      grid.appendChild(btn);
    });
  }

  function goPane(n) {
    $$(".booking-pane").forEach((pane) => {
      const id = pane.getAttribute("data-pane");
      pane.hidden = String(id) !== String(n);
    });
    $$("[data-step-btn]").forEach((btn) => {
      const step = Number(btn.getAttribute("data-step-btn"));
      btn.classList.toggle("is-on", String(n) === String(step));
      btn.classList.toggle("is-done", typeof n === "number" && step < n);
      btn.setAttribute("aria-selected", String(n) === String(step) ? "true" : "false");
    });
    if (n === 4) renderReview();
  }

  function renderReview() {
    const p = compute();
    const card = $("#review-card");
    if (!card) return;
    const name = ($("#name") && $("#name").value) || "—";
    const email = ($("#email") && $("#email").value) || "—";
    const phone = ($("#phone") && $("#phone").value) || "—";
    const addr = ($("#book-address") && $("#book-address").value) || state.address || "—";
    const notes = ($("#notes") && $("#notes").value) || "None";
    const week = state.startWeek
      ? "Week of " + formatWeek(new Date(state.startWeek + "T12:00:00"))
      : "Not chosen";
    card.innerHTML =
      '<p class="kicker light">Review</p>' +
      "<h3>Starting at " + money(p.visit) + " " + p.unitShort + "</h3>" +
      "<dl>" +
      "<div><dt>Plan</dt><dd>" + p.plan.name + "</dd></div>" +
      "<div><dt>Add-ons</dt><dd>" + addonList() + "</dd></div>" +
      "<div><dt>Start week</dt><dd>" + week + "</dd></div>" +
      "<div><dt>Name</dt><dd>" + escapeHtml(name) + "</dd></div>" +
      "<div><dt>Email</dt><dd>" + escapeHtml(email) + "</dd></div>" +
      "<div><dt>Phone</dt><dd>" + escapeHtml(phone) + "</dd></div>" +
      "<div><dt>Address</dt><dd>" + escapeHtml(addr) + "</dd></div>" +
      "<div><dt>Season estimate</dt><dd>About " + money(p.season) + "</dd></div>" +
      "</dl>" +
      '<p class="fine">Notes: ' + escapeHtml(notes) + "</p>" +
      '<p class="fine">Preview only — this will not be billed or sent to a live dispatch inbox.</p>';
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function collectRequest() {
    const p = compute();
    return {
      company: "Yard Week",
      createdAt: new Date().toISOString(),
      preview: true,
      plan: state.plan,
      planName: p.plan.name,
      edging: state.edging,
      bagging: state.bagging,
      everyOtherWeek: state.eow,
      startingPricePerVisit: p.visit,
      unit: p.unit,
      seasonEstimate: p.season,
      visits: p.visits,
      startWeek: state.startWeek,
      name: $("#name") ? $("#name").value.trim() : "",
      email: $("#email") ? $("#email").value.trim() : "",
      phone: $("#phone") ? $("#phone").value.trim() : "",
      serviceAddress: $("#book-address") ? $("#book-address").value.trim() : "",
      zip: extractZip($("#book-address") ? $("#book-address").value : "") || state.zip,
      inServiceArea: state.inArea,
      notes: $("#notes") ? $("#notes").value.trim() : ""
    };
  }

  function mailtoHref(req) {
    const subject = encodeURIComponent("Yard Week route request — " + (req.name || "New request") + " — " + req.planName);
    const body = encodeURIComponent(
      "Yard Week preview request\n\n" +
      "Name: " + req.name + "\n" +
      "Email: " + req.email + "\n" +
      "Phone: " + req.phone + "\n" +
      "Address: " + req.serviceAddress + "\n" +
      "Plan: " + req.planName + "\n" +
      "Add-ons: " + addonList() + "\n" +
      "Frequency: " + (req.everyOtherWeek ? "Every other week" : "Weekly") + "\n" +
      "Start week: " + req.startWeek + "\n" +
      "Starting price: $" + req.startingPricePerVisit + " " + req.unit + "\n" +
      "Season estimate: $" + req.seasonEstimate + "\n" +
      "Notes: " + (req.notes || "None") + "\n\n" +
      "This came from the preview site. The inbox is a placeholder until Kyle publishes a real address.\n"
    );
    return "mailto:" + EMAIL_PLACEHOLDER + "?subject=" + subject + "&body=" + body;
  }

  /* Header */
  const header = $("#header");
  const menuBtn = $(".menu-btn");
  const mobileNav = $("#mobile-nav");
  function setMenu(open) {
    if (!header || !menuBtn) return;
    header.classList.toggle("is-open", open);
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    if (mobileNav) mobileNav.hidden = !open;
  }
  if (menuBtn) {
    menuBtn.addEventListener("click", () => setMenu(!header.classList.contains("is-open")));
  }
  $$("#mobile-nav a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
  window.addEventListener("scroll", () => {
    if (header) header.classList.toggle("is-stuck", window.scrollY > 8);
  }, { passive: true });

  /* Quote controls */
  $$(".choice[data-plan]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.plan = btn.getAttribute("data-plan");
      syncPlanButtons();
      renderQuote();
    });
  });
  $$("[data-select-plan]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.plan = btn.getAttribute("data-select-plan");
      syncPlanButtons();
      renderQuote();
      const quote = $("#quote");
      if (quote) quote.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  $$("[data-addon]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-addon");
      state[key] = !state[key];
      syncToggles();
      renderQuote();
    });
  });
  $$("[data-book-addon]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-book-addon");
      state[key] = !state[key];
      syncToggles();
      renderQuote();
    });
  });
  const address = $("#address");
  if (address) {
    const onAddr = () => {
      state.address = address.value.trim();
      state.zip = extractZip(state.address);
      updateAreaHint();
      const bookAddr = $("#book-address");
      if (bookAddr && !bookAddr.value) bookAddr.value = state.address;
    };
    address.addEventListener("input", onAddr);
    address.addEventListener("change", onAddr);
  }
  const bookPlan = $("#book-plan");
  if (bookPlan) {
    bookPlan.addEventListener("change", () => {
      state.plan = bookPlan.value;
      syncPlanButtons();
      renderQuote();
    });
  }
  const quoteForm = $("#quote-form");
  if (quoteForm) {
    quoteForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const book = $("#book");
      if (book) book.scrollIntoView({ behavior: "smooth", block: "start" });
      goPane(1);
    });
  }

  /* Booking stepper */
  $$("[data-step-btn]").forEach((btn) => {
    btn.addEventListener("click", () => goPane(Number(btn.getAttribute("data-step-btn"))));
  });
  $$("[data-next]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = Number(btn.getAttribute("data-next"));
      if (next === 4) {
        const form = $("#book-form");
        if (form && !form.reportValidity()) {
          goPane(3);
          return;
        }
      }
      goPane(next);
    });
  });
  $$("[data-prev]").forEach((btn) => {
    btn.addEventListener("click", () => goPane(Number(btn.getAttribute("data-prev"))));
  });

  const bookForm = $("#book-form");
  if (bookForm) {
    bookForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!bookForm.reportValidity()) {
        goPane(3);
        return;
      }
      const req = collectRequest();
      state.lastRequest = req;
      try { localStorage.setItem("yardweek-request", JSON.stringify(req, null, 2)); } catch (err) { /* private mode */ }
      const mail = $("#mailto-link");
      if (mail) mail.setAttribute("href", mailtoHref(req));
      goPane("done");
    });
  }
  const downloadBtn = $("#download-json");
  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      const req = state.lastRequest || collectRequest();
      const blob = new Blob([JSON.stringify(req, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "yardweek-request.json";
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  /* FAQ */
  $$(".faq-item button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".faq-item");
      const open = !item.classList.contains("is-open");
      $$(".faq-item").forEach((el) => {
        el.classList.remove("is-open");
        const b = $("button", el);
        if (b) b.setAttribute("aria-expanded", "false");
      });
      if (open) {
        item.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
      }
    });
  });

  /* Reveal */
  const revealEls = $$(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-in"));
  }

  buildWeeks();
  syncPlanButtons();
  syncToggles();
  renderQuote();
  goPane(1);
})();
