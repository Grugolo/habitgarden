/* Habit Garden — vanilla JS, no build step, no login, no notifications.
   Data lives in localStorage only, on-device. */

(() => {
  "use strict";

  /* ---------------- storage ---------------- */
  const STORAGE_KEY = "habitgarden:habits:v2";
  const OLD_STORAGE_KEY = "habitgarden:habits:v1";

  function loadHabits() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return migrate(JSON.parse(raw));
      const old = localStorage.getItem(OLD_STORAGE_KEY);
      if (old) return migrate(JSON.parse(old));
    } catch (e) { /* corrupt or unavailable, fall through */ }
    return seedHabits();
  }

  // history entries used to be a bare string ("done" | "slip").
  // now each entry is { status, note }. Migrate old data forward.
  function migrate(habits) {
    return habits.map((h) => {
      const history = {};
      for (const key in h.history) {
        const v = h.history[key];
        if (typeof v === "string") history[key] = { status: v, note: "" };
        else history[key] = v;
      }
      return { ...h, history };
    });
  }

  function saveHabits(habits) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
    } catch (e) { /* storage full or unavailable — fail silently, in-memory still works */ }
  }

  function uid() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function seedHabits() {
    const now = Date.now();
    return [
      { id: uid(), name: "Morning walk", type: "good", species: pickSpecies("good"), createdAt: now, history: {} },
      { id: uid(), name: "Read 10 min", type: "good", species: pickSpecies("good"), createdAt: now, history: {} },
      { id: uid(), name: "Drink water", type: "good", species: pickSpecies("good"), createdAt: now, history: {} },
      { id: uid(), name: "Late-night scrolling", type: "bad", species: pickSpecies("bad"), createdAt: now, history: {} },
    ];
  }

  /* ---------------- species ----------------
     Richer, more exuberant palette per species. Each plant looks modest
     early on (computeHealth/growth handles that) but has real "wow" ceiling
     at full bloom — bigger, more saturated, more flowers. */
  const SPECIES = [
    {
      id: "fern", label: "Fern", leafShape: "frond",
      palette: ["#2F6B3A", "#4E9350", "#8FCB7E"], bloomColor: "#E8B23D", centerColor: "#FFE8A3",
    },
    {
      id: "succulent", label: "Succulent", leafShape: "rosette",
      palette: ["#3E7A5E", "#5FA680", "#9ED4B2"], bloomColor: "#E8608F", centerColor: "#FFD1E0",
    },
    {
      id: "vine", label: "Flowering vine", leafShape: "vine",
      palette: ["#2E5B3C", "#4F8F52", "#86C46B"], bloomColor: "#E85D75", centerColor: "#FFF1B8",
    },
    {
      id: "hibiscus", label: "Hibiscus", leafShape: "frond",
      palette: ["#356B3F", "#4F9450", "#8ACB6E"], bloomColor: "#E8433F", centerColor: "#FFCF5C",
    },
    {
      id: "orchid", label: "Orchid", leafShape: "vine",
      palette: ["#3A6B4E", "#57996A", "#94D2A2"], bloomColor: "#9B5DE5", centerColor: "#F2E1FF",
    },
    {
      id: "wisteria", label: "Wisteria", leafShape: "vine",
      palette: ["#3F6B4A", "#5C9A62", "#98D19D"], bloomColor: "#8067DE", centerColor: "#E6DEFF",
    },
    {
      id: "poppy", label: "Poppy", leafShape: "frond",
      palette: ["#3A6B3A", "#59974F", "#93CE7C"], bloomColor: "#E8542E", centerColor: "#3A2A1A",
    },
    {
      id: "lavender", label: "Lavender", leafShape: "rosette",
      palette: ["#4E7A6A", "#6FA48C", "#A9CFB9"], bloomColor: "#7A63C9", centerColor: "#D9CFFF",
    },
    {
      id: "bramble", label: "Thorned bramble (weed)", leafShape: "thorn",
      palette: ["#7A5240", "#96684F", "#B98B69"], isWeed: true,
    },
    {
      id: "nettle", label: "Creeping nettle (weed)", leafShape: "thorn",
      palette: ["#5E6B3F", "#7C8A55", "#9FAE77"], isWeed: true,
    },
  ];
  function speciesOf(id) { return SPECIES.find((s) => s.id === id) || SPECIES[0]; }
  function pickSpecies(type) {
    const opts = SPECIES.filter((s) => (type === "bad" ? s.isWeed : !s.isWeed));
    return pick(opts).id;
  }

  /* ---------------- date helpers ---------------- */
  function dkey(d) {
    const x = d ? new Date(d) : new Date();
    x.setHours(0, 0, 0, 0);
    return x.toISOString().slice(0, 10);
  }
  function daysAgoKey(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return dkey(d);
  }
  function isWinter() {
    const m = new Date().getMonth();
    return m === 11 || m === 0 || m === 1;
  }
  function formatDay(key) {
    const d = new Date(key + "T00:00:00");
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }

  /* ---------------- health model ---------------- */
  function computeHealth(habit) {
    const days = 21;
    let health = 50;
    let streak = 0;
    let brokenRecently = false;

    for (let i = days - 1; i >= 0; i--) {
      const key = daysAgoKey(i);
      const entry = habit.history[key];
      const status = entry && entry.status;
      if (status === "done") {
        health = Math.min(100, health + 6);
      } else if (status === "slip") {
        health = Math.max(0, health - 18);
      } else if (!entry) {
        const created = dkey(habit.createdAt);
        if (key >= created) health = Math.max(0, health - 2.2);
      }
    }

    for (let i = 0; i < days; i++) {
      const key = daysAgoKey(i);
      const entry = habit.history[key];
      if (entry && entry.status === "done") streak++;
      else if (i === 0 && !entry) continue;
      else break;
    }

    const last3 = [0, 1, 2].map((i) => habit.history[daysAgoKey(i)]);
    if (last3.some((e) => e && e.status === "slip")) brokenRecently = true;

    const stage =
      health >= 80 ? "blooming" :
      health >= 55 ? "thriving" :
      health >= 30 ? "steady" :
      health >= 12 ? "wilting" : "dormant";

    return { health, streak, stage, brokenRecently };
  }

  const STAGE_LABEL = {
    blooming: "Blooming",
    thriving: "Thriving",
    steady: "Steady",
    wilting: "Wilting — needs you",
    dormant: "Dormant — needs you",
  };

  /* ---------------- SVG plant renderer ---------------- */
  const SVG_NS = "http://www.w3.org/2000/svg";

  function el(tag, attrs) {
    const node = document.createElementNS(SVG_NS, tag);
    if (attrs) for (const k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }

  function renderPlant(habit, size) {
    const { health, stage } = computeHealth(habit);
    const species = speciesOf(habit.species);
    const [c1, c2, c3] = species.palette;
    const winterCover = isWinter() && !species.isWeed;
    const growth = Math.max(0.16, health / 100);
    const stemH = 66 * growth + 18;
    // more exuberant at full health: up to 5 blooms instead of 3
    const bloomCount = health >= 88 ? 5 : health >= 72 ? 3 : health >= 55 ? 1 : 0;
    const wilt = stage === "wilting" || stage === "dormant";
    const seed = habit.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const uidLocal = habit.id;
    const bloomColor = species.bloomColor || "#D98F5F";
    const centerColor = species.centerColor || "#F4D58D";

    const svg = el("svg", {
      viewBox: "0 0 180 220",
      width: size,
      height: Math.round(size * 1.22),
      style: "overflow:visible",
    });

    const defs = el("defs");
    const pot = el("radialGradient", { id: `pot-${uidLocal}`, cx: "35%", cy: "20%", r: "90%" });
    pot.appendChild(el("stop", { offset: "0%", "stop-color": "#C79A6E" }));
    pot.appendChild(el("stop", { offset: "100%", "stop-color": "#A97246" }));
    const soil = el("linearGradient", { id: `soil-${uidLocal}`, x1: "0", y1: "0", x2: "0", y2: "1" });
    soil.appendChild(el("stop", { offset: "0%", "stop-color": "#5A4332" }));
    soil.appendChild(el("stop", { offset: "100%", "stop-color": "#3E2E22" }));
    defs.appendChild(pot);
    defs.appendChild(soil);
    svg.appendChild(defs);

    const potCx = 90, potTopY = 186;
    svg.appendChild(el("path", { d: `M${potCx-35} ${potTopY} L${potCx+35} ${potTopY} L${potCx+26} ${potTopY+30} L${potCx-26} ${potTopY+30} Z`, fill: `url(#pot-${uidLocal})` }));
    svg.appendChild(el("ellipse", { cx: potCx, cy: potTopY, rx: "35", ry: "7", fill: `url(#soil-${uidLocal})` }));
    svg.appendChild(el("rect", { x: potCx-38, y: potTopY-8, width: "76", height: "10", rx: "3", fill: "#B98454" }));

    if (species.leafShape === "rosette") {
      const g = el("g", { style: `transform-origin:${potCx}px ${potTopY}px` });
      const leafN = 10;
      for (let i = 0; i < leafN; i++) {
        const ang = (i / leafN) * Math.PI * 2 + (seed % 10) * 0.05;
        const len = 20 + growth * 34 + ((i + seed) % 3) * 5;
        const x2 = potCx + Math.cos(ang) * len * 0.9;
        const y2 = potTopY - Math.sin(ang) * len * 0.55 - len * 0.3;
        const col = i % 2 === 0 ? c2 : c3;
        g.appendChild(el("path", {
          d: `M${potCx} ${potTopY} Q ${potCx + Math.cos(ang) * len * 0.5} ${potTopY - len * 0.7} ${x2} ${y2}`,
          stroke: wilt ? "#9C8F6E" : col,
          "stroke-width": 8 - growth * 2,
          "stroke-linecap": "round",
          fill: "none",
          opacity: wilt ? 0.6 : 0.97,
        }));
      }
      if (bloomCount > 0) {
        for (let i = 0; i < bloomCount; i++) {
          const ang2 = (i / bloomCount) * Math.PI * 2 + 0.4;
          const bx = potCx + Math.cos(ang2) * 8;
          const by = potTopY - 40 * growth - Math.sin(ang2) * 6;
          g.appendChild(bloomFlower(bx, by, 5 + growth * 4, bloomColor, centerColor));
        }
      }
      svg.appendChild(g);
    } else {
      const g = el("g");
      const stemTopY = potTopY - stemH;
      g.appendChild(el("path", {
        d: `M${potCx} ${potTopY} C ${potCx + (seed % 7 - 3)} ${potTopY - stemH * 0.6}, ${potCx - (seed % 5 - 2)} ${potTopY - stemH * 0.9}, ${potCx} ${stemTopY}`,
        stroke: wilt ? "#8C8161" : c1,
        "stroke-width": "5.5",
        fill: "none",
        "stroke-linecap": "round",
      }));

      const leafPairs = species.leafShape === "vine" ? 5 : species.leafShape === "frond" ? 6 : 0;
      for (let i = 0; i < leafPairs; i++) {
        if ((i + 1) * (stemH / (leafPairs + 1)) > stemH) continue;
        const t = (i + 1) / (leafPairs + 1);
        const y = potTopY - stemH * t;
        const side = i % 2 === 0 ? 1 : -1;
        const leafLen = (species.leafShape === "frond" ? 30 : 24) * (0.7 + growth * 0.5);
        const droop = wilt ? 20 : 2;
        const col = i % 2 === 0 ? c2 : c3;
        g.appendChild(el("path", {
          d: `M${potCx} ${y} Q ${potCx + side * leafLen} ${y - 7 + droop} ${potCx + side * (leafLen + 7)} ${y + 11 + droop}`,
          fill: "none",
          stroke: wilt ? "#9C8F6E" : col,
          "stroke-width": species.isWeed ? 3.5 : 7,
          "stroke-linecap": "round",
          opacity: wilt ? 0.65 : 1,
        }));
      }

      if (species.isWeed) {
        for (let i = 0; i < 4; i++) {
          g.appendChild(el("line", {
            x1: potCx,
            y1: potTopY - stemH * (0.25 + i * 0.18),
            x2: potCx + (i % 2 ? 12 : -12),
            y2: potTopY - stemH * (0.25 + i * 0.18) - 7,
            stroke: "#5A4332",
            "stroke-width": "2.2",
          }));
        }
      }

      if (!species.isWeed && bloomCount > 0) {
        const positions = [
          [0, 0], [-16, 6], [16, 6], [-9, 16], [9, 16],
        ].slice(0, bloomCount);
        positions.forEach(([dx, dy]) => {
          g.appendChild(bloomFlower(potCx + dx, stemTopY + dy, 7 + growth * 5, bloomColor, centerColor));
        });
      }
      svg.appendChild(g);
    }

    if (winterCover) {
      svg.appendChild(el("path", {
        d: `M${potCx-40} ${potTopY - stemH - 16} Q ${potCx} ${potTopY - stemH - 42} ${potCx+40} ${potTopY - stemH - 16} L ${potCx+38} ${potTopY} L ${potCx-38} ${potTopY} Z`,
        fill: "#8FAFC2", opacity: "0.26", stroke: "#5C7F94", "stroke-width": "1.5", "stroke-dasharray": "4 3",
      }));
    }

    // pollination sparkle when thriving/blooming and in good health
    if (!species.isWeed && health >= 85) {
      const sparklePts = [[potCx-30, potTopY-stemH-6], [potCx+34, potTopY-stemH+10]];
      sparklePts.forEach(([sx, sy], i) => {
        g_sparkle(svg, sx, sy, i);
      });
    }

    return svg;
  }

  function g_sparkle(svg, x, y, i) {
    const s = el("g", { opacity: "0.9" });
    s.appendChild(el("circle", { cx: x, cy: y, r: 2.4, fill: "#FFE9A8" }));
    s.appendChild(el("circle", { cx: x + 6, cy: y - 4, r: 1.4, fill: "#FFE9A8" }));
    svg.appendChild(s);
  }

  function bloomFlower(x, y, r, bloomColor, centerColor) {
    const g = el("g", { style: `transform-origin:${x}px ${y}px` });
    const petals = 5;
    for (let p = 0; p < petals; p++) {
      g.appendChild(el("ellipse", {
        cx: x, cy: y - r * 0.55, rx: r * 0.62, ry: r,
        fill: bloomColor,
        transform: `rotate(${p * (360 / petals)} ${x} ${y})`,
        opacity: "0.94",
      }));
    }
    g.appendChild(el("circle", { cx: x, cy: y, r: r * 0.42, fill: centerColor }));
    return g;
  }

  /* ---------------- state ---------------- */
  let habits = loadHabits();
  let view = { screen: "garden" };

  function persist() { saveHabits(habits); }

  function logHabit(id, status, note) {
    const key = dkey();
    habits = habits.map((h) => {
      if (h.id !== id) return h;
      const history = { ...h.history };
      if (status === undefined) delete history[key];
      else history[key] = { status, note: note || "" };
      return { ...h, history };
    });
    persist();
    render();
  }

  function addHabit(data) {
    habits = [...habits, { id: uid(), createdAt: Date.now(), history: {}, ...data }];
    persist();
    view = { screen: "garden" };
    render();
  }

  function deleteHabit(id) {
    habits = habits.filter((h) => h.id !== id);
    persist();
    view = { screen: "garden" };
    render();
  }

  function replaceAllHabits(newHabits) {
    habits = migrate(newHabits);
    persist();
    view = { screen: "garden" };
    render();
  }

  /* ---------------- render helpers ---------------- */
  const root = document.getElementById("app");
  const modalRoot = document.getElementById("modal-root");

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function h(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === "class") node.className = attrs[k];
        else if (k === "text") node.textContent = attrs[k];
        else if (k.startsWith("on") && typeof attrs[k] === "function") {
          node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else {
          node.setAttribute(k, attrs[k]);
        }
      }
    }
    (children || []).forEach((c) => { if (c) node.appendChild(c); });
    return node;
  }

  function btn(label, cls, onClick, disabled) {
    const b = h("button", { class: `btn ${cls}`, onClick, text: label });
    if (disabled) b.disabled = true;
    return b;
  }

  /* ---------------- day-note modal ---------------- */
  function openNoteModal(habit, status) {
    clear(modalRoot);
    modalRoot.classList.add("open");

    const isGood = habit.type === "good";
    const title = status === "slip"
      ? "What happened?"
      : (isGood ? "What did you do?" : "How did you resist?");
    const placeholder = status === "slip"
      ? "Optional — jot down the context, no judgment…"
      : "Optional — a quick note for future you…";

    const existing = habit.history[dkey()];
    const textarea = h("textarea", {
      class: "note-textarea",
      placeholder,
      rows: "4",
    });
    textarea.value = existing ? existing.note || "" : "";

    const card = h("div", { class: "modal-card" }, [
      h("div", { class: "modal-plant" }, [renderPlant(habit, 96)]),
      h("h2", { class: "modal-title", text: title }),
      h("p", { class: "modal-sub", text: habit.name }),
      textarea,
      h("div", { class: "modal-actions" }, [
        h("button", { class: "btn btn-outline-modal", text: "Skip", onClick: () => {
          logHabit(habit.id, status, "");
          closeModal();
        }}),
        h("button", { class: "btn btn-leaf", text: "Save", onClick: () => {
          logHabit(habit.id, status, textarea.value.trim());
          closeModal();
        }}),
      ]),
    ]);

    const overlay = h("div", { class: "modal-overlay", onClick: (e) => { if (e.target === overlay) closeModal(); } }, [card]);
    modalRoot.appendChild(overlay);
    setTimeout(() => textarea.focus(), 50);
  }

  function closeModal() {
    modalRoot.classList.remove("open");
    clear(modalRoot);
  }

  /* ---------------- settings modal (export/import) ---------------- */
  function openSettingsModal() {
    clear(modalRoot);
    modalRoot.classList.add("open");

    const exportData = JSON.stringify(habits, null, 2);

    const textarea = h("textarea", { class: "note-textarea settings-textarea", rows: "8" });
    textarea.value = exportData;

    const statusMsg = h("p", { class: "settings-status" });

    const copyBtn = h("button", { class: "btn btn-water", text: "Copy to clipboard", onClick: async () => {
      try {
        await navigator.clipboard.writeText(textarea.value);
        statusMsg.textContent = "Copied ✓";
        statusMsg.className = "settings-status ok";
      } catch (e) {
        statusMsg.textContent = "Couldn't copy automatically — select and copy manually.";
        statusMsg.className = "settings-status err";
      }
    }});

    const downloadBtn = h("button", { class: "btn btn-leaf", text: "Download .json", onClick: () => {
      const blob = new Blob([exportData], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `habit-garden-backup-${dkey()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }});

    const importBtn = h("button", { class: "btn btn-warn", text: "Import (replaces current garden)", onClick: () => {
      try {
        const parsed = JSON.parse(textarea.value);
        if (!Array.isArray(parsed)) throw new Error("not an array");
        if (!confirm("This will replace your current garden with the pasted data. Continue?")) return;
        replaceAllHabits(parsed);
        closeModal();
      } catch (e) {
        statusMsg.textContent = "That doesn't look like valid Habit Garden JSON.";
        statusMsg.className = "settings-status err";
      }
    }});

    const card = h("div", { class: "modal-card" }, [
      h("h2", { class: "modal-title", text: "Export / Import" }),
      h("p", { class: "modal-sub", text: "Your garden's data as text. Copy it somewhere safe, or paste older data below to restore it." }),
      textarea,
      statusMsg,
      h("div", { class: "modal-actions settings-actions" }, [copyBtn, downloadBtn]),
      h("div", { class: "modal-actions settings-actions" }, [importBtn]),
      h("div", { class: "modal-actions" }, [
        h("button", { class: "btn btn-outline-modal", text: "Close", onClick: closeModal }),
      ]),
    ]);

    const overlay = h("div", { class: "modal-overlay", onClick: (e) => { if (e.target === overlay) closeModal(); } }, [card]);
    modalRoot.appendChild(overlay);
  }

  /* ---------------- screens ---------------- */
  function renderGarden() {
    const screen = h("div", { class: "screen" });

    const todayKey = dkey();
    const done = habits.filter((hb) => hb.history[todayKey] && hb.history[todayKey].status === "done").length;

    const headerTop = h("div", { class: "header-top" }, [
      h("div", {}, [
        h("div", { class: "day-label", text: isWinter()
          ? "Winter — covers are on"
          : new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) }),
        h("h1", { class: "page-title", text: "Your garden" }),
      ]),
      h("button", { class: "icon-btn", "aria-label": "Settings", onClick: openSettingsModal, text: "⚙" }),
    ]);

    const header = h("header", { style: "margin-bottom:22px" }, [
      headerTop,
      habits.length
        ? h("p", { class: "page-sub", text: `${done} of ${habits.length} tended today` })
        : null,
    ]);
    screen.appendChild(header);

    if (habits.length === 0) {
      screen.appendChild(h("div", { class: "empty-state", text: "No plants yet. Add a habit below to start your garden." }));
    } else {
      const good = habits.filter((hb) => hb.type === "good");
      const bad = habits.filter((hb) => hb.type === "bad");

      if (good.length) {
        const section = h("section", { style: "margin-bottom:26px" });
        good.forEach((hb) => section.appendChild(renderHabitRow(hb)));
        screen.appendChild(section);
      }
      if (bad.length) {
        const section = h("section", { style: "margin-bottom:26px" });
        section.appendChild(h("div", { class: "section-label", text: "Weeds you're taming" }));
        bad.forEach((hb) => section.appendChild(renderHabitRow(hb)));
        screen.appendChild(section);
      }
    }

    screen.appendChild(h("button", {
      class: "btn-outline",
      text: "+ Plant a new habit",
      onClick: () => { view = { screen: "add" }; render(); },
    }));

    screen.appendChild(h("p", {
      class: "footer-note",
      text: "No streak counters shouting at you. Miss a day and the plant just needs a little water tomorrow — it doesn't die.",
    }));

    return screen;
  }

  function renderHabitRow(habit) {
    const { stage, streak, brokenRecently } = computeHealth(habit);
    const todayKey = dkey();
    const todayEntry = habit.history[todayKey];
    const todayStatus = todayEntry && todayEntry.status;

    const plantWrap = h("div", { class: "habit-plant" });
    plantWrap.appendChild(renderPlant(habit, 96));

    const meta = h("div", { class: "habit-meta" }, [
      h("span", { class: `stage-label stage-${stage}`, text: STAGE_LABEL[stage] }),
      streak > 0
        ? h("span", { class: "streak-label", text: `${streak}d ${habit.type === "good" ? "watered" : "clear"}` })
        : null,
      (habit.type === "bad" && brokenRecently)
        ? h("span", { class: "cover-label", text: "under cover — be gentle" })
        : null,
    ]);

    const info = h("div", { class: "habit-info" }, [
      h("div", { class: "habit-name", text: habit.name }),
      meta,
    ]);

    const action = h("div", { class: "habit-action" });
    action.addEventListener("click", (e) => e.stopPropagation());
    if (todayStatus === "done") {
      action.appendChild(h("span", { class: "done-tag", text: habit.type === "good" ? "Watered ✓" : "Resisted ✓" }));
    } else {
      const label = habit.type === "good" ? "Water today" : "Mark resisted";
      const cls = habit.type === "bad" ? "btn-water" : "btn-leaf";
      action.appendChild(btn(label, cls, () => openNoteModal(habit, "done")));
    }

    const row = h("div", { class: "habit-row", onClick: () => { view = { screen: "detail", habitId: habit.id }; render(); } }, [
      plantWrap, info, action,
    ]);
    return row;
  }

  function renderDetail(habitId) {
    const habit = habits.find((hb) => hb.id === habitId);
    const screen = h("div", { class: "screen" });
    if (!habit) {
      screen.appendChild(h("p", { text: "This plant is gone." }));
      screen.appendChild(h("button", { class: "back-btn", text: "← Garden", onClick: () => { view = { screen: "garden" }; render(); } }));
      return screen;
    }

    const { health, stage, streak } = computeHealth(habit);
    const todayKey = dkey();
    const todayEntry = habit.history[todayKey];
    const todayStatus = todayEntry && todayEntry.status;
    const winterCover = isWinter();

    screen.appendChild(h("button", { class: "back-btn", text: "← Garden", onClick: () => { view = { screen: "garden" }; render(); } }));

    const plantWrap = h("div", { class: "detail-plant-wrap" });
    plantWrap.appendChild(renderPlant(habit, 230));
    screen.appendChild(plantWrap);

    screen.appendChild(h("h1", { class: "detail-title", text: habit.name }));
    screen.appendChild(h("div", { class: "detail-stage" }, [
      h("span", { class: `stage-label stage-${stage}`, text: STAGE_LABEL[stage] }),
    ]));

    screen.appendChild(h("div", { class: "stat-row" }, [
      h("div", { class: "stat-card" }, [
        h("div", { class: "stat-value", text: `${Math.round(health)}%` }),
        h("div", { class: "stat-label", text: "Health" }),
      ]),
      h("div", { class: "stat-card" }, [
        h("div", { class: "stat-value", text: `${streak}d` }),
        h("div", { class: "stat-label", text: "Streak" }),
      ]),
    ]));

    if (winterCover && habit.type === "bad") {
      screen.appendChild(h("p", {
        class: "cover-note",
        text: "Winter cover is on. A slip now won't wilt this plant as fast — care for yourself gently through the season.",
      }));
    }

    const actions = h("div", { class: "action-row" });
    if (todayStatus !== "done") {
      actions.appendChild(btn(
        habit.type === "good" ? "Water today" : "Mark resisted today",
        "btn-leaf",
        () => openNoteModal(habit, "done")
      ));
    }
    if (habit.type === "bad" && todayStatus !== "slip") {
      actions.appendChild(btn("Log a slip — it's okay", "btn-warn", () => openNoteModal(habit, "slip")));
    }
    if (todayStatus) {
      actions.appendChild(btn("Undo today", "btn-water", () => logHabit(habit.id, undefined)));
    }
    screen.appendChild(actions);

    // streak strip — fills from the LEFT, most recent day on the right
    const stripWrap = h("div", { style: "margin-bottom:30px" });
    stripWrap.appendChild(h("div", { class: "strip-label", text: "Last 21 days" }));
    const strip = h("div", { class: "day-strip" });
    for (let i = 20; i >= 0; i--) {
      const key = daysAgoKey(i);
      const entry = habit.history[key];
      const status = entry && entry.status;
      const cellCls = status === "done" ? "day-cell done" : status === "slip" ? "day-cell slip" : "day-cell";
      strip.appendChild(h("div", { class: cellCls, title: key }));
    }
    stripWrap.appendChild(strip);
    screen.appendChild(stripWrap);

    // full history log, most recent first, including notes
    const historyEntries = Object.keys(habit.history)
      .sort((a, b) => (a < b ? 1 : -1));

    if (historyEntries.length) {
      const logWrap = h("div", { style: "margin-bottom:20px" });
      logWrap.appendChild(h("div", { class: "strip-label", text: "History" }));
      const list = h("div", { class: "history-list" });
      historyEntries.forEach((key) => {
        const entry = habit.history[key];
        const isDone = entry.status === "done";
        const dot = h("span", { class: `history-dot ${isDone ? "done" : "slip"}` });
        const item = h("div", { class: "history-item" }, [
          dot,
          h("div", { class: "history-item-body" }, [
            h("div", { class: "history-item-top" }, [
              h("span", { class: "history-date", text: formatDay(key) }),
              h("span", { class: `history-status ${isDone ? "done" : "slip"}`, text: isDone
                ? (habit.type === "good" ? "Watered" : "Resisted")
                : "Slip" }),
            ]),
            entry.note ? h("div", { class: "history-note", text: entry.note }) : null,
          ]),
        ]);
        list.appendChild(item);
      });
      logWrap.appendChild(list);
      screen.appendChild(logWrap);
    }

    screen.appendChild(h("div", { class: "detail-footer" }, [
      h("button", { class: "text-link", text: "Remove this plant", onClick: () => {
        if (confirm(`Remove "${habit.name}" and all its history?`)) deleteHabit(habit.id);
      }}),
    ]));

    return screen;
  }

  function renderAdd() {
    const screen = h("div", { class: "screen" });
    screen.appendChild(h("button", { class: "back-btn", text: "← Garden", onClick: () => { view = { screen: "garden" }; render(); } }));
    screen.appendChild(h("h1", { class: "page-title", style: "font-size:26px;margin-bottom:20px", text: "Plant something new" }));

    let name = "";
    let type = "good";

    screen.appendChild(h("label", { class: "field-label", text: "What are you growing?" }));
    const input = h("input", { class: "text-input", placeholder: "e.g. Stretch before bed", type: "text" });
    input.addEventListener("input", (e) => {
      name = e.target.value;
      plantBtn.disabled = !name.trim();
    });
    screen.appendChild(input);

    const typeRow = h("div", { class: "type-row" });
    const goodBtn = h("button", { class: "type-btn active", text: "Good habit — grows a plant" });
    const badBtn = h("button", { class: "type-btn", text: "Bad habit — tame a weed" });
    goodBtn.addEventListener("click", () => {
      type = "good";
      goodBtn.classList.add("active"); badBtn.classList.remove("active");
    });
    badBtn.addEventListener("click", () => {
      type = "bad";
      badBtn.classList.add("active"); goodBtn.classList.remove("active");
    });
    typeRow.appendChild(goodBtn);
    typeRow.appendChild(badBtn);
    screen.appendChild(typeRow);

    screen.appendChild(h("p", { class: "field-hint", text: "A species is chosen for you at random — every plant grows more lush and colorful the healthier it gets." }));

    const plantBtn = btn("Plant it", "btn-leaf", () => {
      if (!name.trim()) return;
      addHabit({ name: name.trim(), type, species: pickSpecies(type) });
    }, true);
    plantBtn.style.marginTop = "8px";
    screen.appendChild(plantBtn);

    return screen;
  }

  /* ---------------- main render ---------------- */
  function render() {
    clear(root);
    if (view.screen === "garden") root.appendChild(renderGarden());
    else if (view.screen === "detail") root.appendChild(renderDetail(view.habitId));
    else if (view.screen === "add") root.appendChild(renderAdd());
  }

  render();
})();
