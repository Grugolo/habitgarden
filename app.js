/* Habit Garden — vanilla JS, no build step, no login, no notifications.
   Data lives in localStorage only, on-device. */

(() => {
  "use strict";

  /* ---------------- storage ---------------- */
  const STORAGE_KEY = "habitgarden:habits:v1";

  function loadHabits() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* corrupt or unavailable, fall through */ }
    return seedHabits();
  }

  function saveHabits(habits) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
    } catch (e) { /* storage full or unavailable — fail silently, in-memory still works */ }
  }

  function uid() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function seedHabits() {
    const now = Date.now();
    return [
      { id: uid(), name: "Morning walk", type: "good", species: "fern", createdAt: now, history: {} },
      { id: uid(), name: "Read 10 min", type: "good", species: "vine", createdAt: now, history: {} },
      { id: uid(), name: "Drink water", type: "good", species: "succulent", createdAt: now, history: {} },
      { id: uid(), name: "Late-night scrolling", type: "bad", species: "bramble", createdAt: now, history: {} },
    ];
  }

  /* ---------------- species ---------------- */
  const SPECIES = [
    { id: "fern", label: "Fern", leafShape: "frond", palette: ["#4F7A4A", "#6E9A5A", "#8AB574"] },
    { id: "succulent", label: "Succulent", leafShape: "rosette", palette: ["#5C8C6A", "#7FAE86", "#A8CCA9"] },
    { id: "vine", label: "Flowering vine", leafShape: "vine", palette: ["#3F6B41", "#6E9A5A", "#94BC7A"] },
    { id: "bramble", label: "Thorned bramble (weed)", leafShape: "thorn", palette: ["#8A5A4A", "#A97158", "#C79470"], isWeed: true },
  ];
  function speciesOf(id) { return SPECIES.find((s) => s.id === id) || SPECIES[0]; }

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

  /* ---------------- health model ---------------- */
  function computeHealth(habit) {
    const days = 21;
    let health = 50;
    let streak = 0;
    let brokenRecently = false;

    for (let i = days - 1; i >= 0; i--) {
      const key = daysAgoKey(i);
      const entry = habit.history[key];
      if (entry === "done") {
        health = Math.min(100, health + 6);
      } else if (entry === "slip") {
        health = Math.max(0, health - 18);
      } else if (entry === undefined) {
        const created = dkey(habit.createdAt);
        if (key >= created) health = Math.max(0, health - 2.2);
      }
    }

    for (let i = 0; i < days; i++) {
      const key = daysAgoKey(i);
      if (habit.history[key] === "done") streak++;
      else if (i === 0 && habit.history[key] === undefined) continue;
      else break;
    }

    const last3 = [0, 1, 2].map((i) => habit.history[daysAgoKey(i)]);
    if (last3.includes("slip")) brokenRecently = true;

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
    const growth = Math.max(0.18, health / 100);
    const stemH = 60 * growth + 20;
    const bloomCount = health >= 80 ? 3 : health >= 60 ? 1 : 0;
    const wilt = stage === "wilting" || stage === "dormant";
    const seed = habit.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const uidLocal = habit.id;

    const svg = el("svg", {
      viewBox: "0 0 160 200",
      width: size,
      height: Math.round(size * 1.15),
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

    svg.appendChild(el("path", { d: "M45 168 L115 168 L106 198 L54 198 Z", fill: `url(#pot-${uidLocal})` }));
    svg.appendChild(el("ellipse", { cx: "80", cy: "168", rx: "35", ry: "7", fill: `url(#soil-${uidLocal})` }));
    svg.appendChild(el("rect", { x: "42", y: "160", width: "76", height: "10", rx: "3", fill: "#B98454" }));

    if (species.leafShape === "rosette") {
      const g = el("g", { style: "transform-origin:80px 168px" });
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2 + (seed % 10) * 0.05;
        const len = 18 + growth * 26 + ((i + seed) % 3) * 4;
        const x2 = 80 + Math.cos(ang) * len * 0.9;
        const y2 = 168 - Math.sin(ang) * len * 0.55 - len * 0.3;
        const col = i % 2 === 0 ? c2 : c3;
        g.appendChild(el("path", {
          d: `M80 168 Q ${80 + Math.cos(ang) * len * 0.5} ${168 - len * 0.7} ${x2} ${y2}`,
          stroke: wilt ? "#9C8F6E" : col,
          "stroke-width": 7 - growth * 2,
          "stroke-linecap": "round",
          fill: "none",
          opacity: wilt ? 0.6 : 0.95,
        }));
      }
      if (bloomCount > 0) {
        g.appendChild(el("circle", { cx: "80", cy: "140", r: 6 + growth * 4, fill: "#D98F5F", opacity: "0.95" }));
      }
      svg.appendChild(g);
    } else {
      const g = el("g");
      g.appendChild(el("path", {
        d: `M80 168 C ${80 + (seed % 7 - 3)} ${168 - stemH * 0.6}, ${80 - (seed % 5 - 2)} ${168 - stemH * 0.9}, 80 ${168 - stemH}`,
        stroke: wilt ? "#8C8161" : c1,
        "stroke-width": "5",
        fill: "none",
        "stroke-linecap": "round",
      }));

      const leafPairs = species.leafShape === "vine" ? 4 : species.leafShape === "frond" ? 5 : 0;
      for (let i = 0; i < leafPairs; i++) {
        if ((i + 1) * (stemH / (leafPairs + 1)) > stemH) continue;
        const t = (i + 1) / (leafPairs + 1);
        const y = 168 - stemH * t;
        const side = i % 2 === 0 ? 1 : -1;
        const leafLen = species.leafShape === "frond" ? 26 : 20;
        const droop = wilt ? 18 : 2;
        const col = i % 2 === 0 ? c2 : c3;
        g.appendChild(el("path", {
          d: `M80 ${y} Q ${80 + side * leafLen} ${y - 6 + droop} ${80 + side * (leafLen + 6)} ${y + 10 + droop}`,
          fill: "none",
          stroke: wilt ? "#9C8F6E" : col,
          "stroke-width": species.isWeed ? 3 : 6,
          "stroke-linecap": "round",
          opacity: wilt ? 0.65 : 1,
        }));
      }

      if (species.isWeed) {
        for (let i = 0; i < 3; i++) {
          g.appendChild(el("line", {
            x1: "80",
            y1: 168 - stemH * (0.3 + i * 0.2),
            x2: 80 + (i % 2 ? 10 : -10),
            y2: 168 - stemH * (0.3 + i * 0.2) - 6,
            stroke: "#7A5240",
            "stroke-width": "2",
          }));
        }
      }

      if (!species.isWeed) {
        for (let i = 0; i < bloomCount; i++) {
          const y = 168 - stemH - i * 10;
          const x = 80 + (i - 1) * 10;
          const bg = el("g", { style: `transform-origin:${x}px ${y}px` });
          for (let p = 0; p < 5; p++) {
            bg.appendChild(el("ellipse", {
              cx: x, cy: y - 5, rx: "5", ry: "8",
              fill: "#D98F5F",
              transform: `rotate(${p * 72} ${x} ${y})`,
              opacity: "0.92",
            }));
          }
          bg.appendChild(el("circle", { cx: x, cy: y, r: "3.5", fill: "#F4D58D" }));
          g.appendChild(bg);
        }
      }
      svg.appendChild(g);
    }

    if (winterCover) {
      svg.appendChild(el("path", {
        d: `M50 ${168 - stemH - 14} Q 80 ${168 - stemH - 36} 110 ${168 - stemH - 14} L 108 168 L 52 168 Z`,
        fill: "#8FAFC2", opacity: "0.28", stroke: "#5C7F94", "stroke-width": "1.5", "stroke-dasharray": "4 3",
      }));
    }

    return svg;
  }

  /* ---------------- state ---------------- */
  let habits = loadHabits();
  let view = { screen: "garden" };

  function persist() { saveHabits(habits); }

  function logHabit(id, status) {
    const key = dkey();
    habits = habits.map((h) => {
      if (h.id !== id) return h;
      const history = { ...h.history };
      if (status === undefined) delete history[key];
      else history[key] = status;
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

  /* ---------------- render helpers ---------------- */
  const root = document.getElementById("app");

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

  /* ---------------- screens ---------------- */
  function renderGarden() {
    const screen = h("div", { class: "screen" });

    const todayKey = dkey();
    const done = habits.filter((hb) => hb.history[todayKey] === "done").length;

    const header = h("header", { style: "margin-bottom:22px" }, [
      h("div", { class: "day-label", text: isWinter()
        ? "Winter — covers are on"
        : new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) }),
      h("h1", { class: "page-title", text: "Your garden" }),
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
    const todayStatus = habit.history[todayKey];

    const plantWrap = h("div", { class: "habit-plant" });
    plantWrap.appendChild(renderPlant(habit, 68));

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
      action.appendChild(btn(label, cls, () => logHabit(habit.id, "done")));
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
    const todayStatus = habit.history[todayKey];
    const winterCover = isWinter();

    screen.appendChild(h("button", { class: "back-btn", text: "← Garden", onClick: () => { view = { screen: "garden" }; render(); } }));

    const plantWrap = h("div", { class: "detail-plant-wrap" });
    plantWrap.appendChild(renderPlant(habit, 220));
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
        () => logHabit(habit.id, "done")
      ));
    }
    if (habit.type === "bad" && todayStatus !== "slip") {
      actions.appendChild(btn("Log a slip — it's okay", "btn-warn", () => logHabit(habit.id, "slip")));
    }
    if (todayStatus) {
      actions.appendChild(btn("Undo today", "btn-water", () => logHabit(habit.id, undefined)));
    }
    screen.appendChild(actions);

    const stripWrap = h("div", { style: "margin-bottom:26px" });
    stripWrap.appendChild(h("div", { class: "strip-label", text: "Last 21 days" }));
    const strip = h("div", { class: "day-strip" });
    for (let i = 20; i >= 0; i--) {
      const key = daysAgoKey(i);
      const status = habit.history[key];
      const cellCls = status === "done" ? "day-cell done" : status === "slip" ? "day-cell slip" : "day-cell";
      strip.appendChild(h("div", { class: cellCls, title: key }));
    }
    stripWrap.appendChild(strip);
    screen.appendChild(stripWrap);

    screen.appendChild(h("div", { class: "detail-footer" }, [
      h("button", { class: "text-link", text: "Remove this plant", onClick: () => deleteHabit(habit.id) }),
    ]));

    return screen;
  }

  function renderAdd() {
    const screen = h("div", { class: "screen" });
    screen.appendChild(h("button", { class: "back-btn", text: "← Garden", onClick: () => { view = { screen: "garden" }; render(); } }));
    screen.appendChild(h("h1", { class: "page-title", style: "font-size:26px;margin-bottom:20px", text: "Plant something new" }));

    let name = "";
    let type = "good";
    let species = "fern";

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
      type = "good"; species = "fern";
      goodBtn.classList.add("active"); badBtn.classList.remove("active");
      renderSpeciesOptions();
    });
    badBtn.addEventListener("click", () => {
      type = "bad"; species = "bramble";
      badBtn.classList.add("active"); goodBtn.classList.remove("active");
      renderSpeciesOptions();
    });
    typeRow.appendChild(goodBtn);
    typeRow.appendChild(badBtn);
    screen.appendChild(typeRow);

    screen.appendChild(h("label", { class: "field-label", text: "Species" }));
    const speciesRow = h("div", { class: "species-row" });
    screen.appendChild(speciesRow);

    function renderSpeciesOptions() {
      clear(speciesRow);
      const options = SPECIES.filter((s) => (type === "bad" ? s.isWeed : !s.isWeed));
      options.forEach((s) => {
        const b = h("button", { class: `species-btn${species === s.id ? " active" : ""}`, text: s.label });
        b.addEventListener("click", () => {
          species = s.id;
          Array.from(speciesRow.children).forEach((c) => c.classList.remove("active"));
          b.classList.add("active");
        });
        speciesRow.appendChild(b);
      });
    }
    renderSpeciesOptions();

    const plantBtn = btn("Plant it", "btn-leaf", () => {
      if (!name.trim()) return;
      addHabit({ name: name.trim(), type, species });
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
