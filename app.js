/* ── МЕМОТЕКА · app.js ───────────────────────────────────── */

const MEMES = [
  {
    id: "drake",
    file: "assets/drake.jpg",
    title: "Программист и документация",
    caption: "«Не буду читать доки» / «Спрошу у ИИ и поверю на слово».",
    tags: ["код", "работа"],
  },
  {
    id: "buttons",
    file: "assets/buttons.jpg",
    title: "Выбор на сегодня",
    caption: "Починить один баг или добавить три фичи и один баг пострашнее.",
    tags: ["код", "дедлайн"],
  },
  {
    id: "distracted",
    file: "assets/distracted.jpg",
    title: "Менеджер и дедлайн",
    caption: "Идёт за дедлайном, но обернулся на «а можно ещё одну фичу».",
    tags: ["работа", "дедлайн"],
  },
  {
    id: "exit-ramp",
    file: "assets/exit-ramp.jpg",
    title: "Ты и понедельник",
    caption: "Пытаешься свернуть, но понедельник уже свернул не туда.",
    tags: ["жизнь", "работа"],
  },
  {
    id: "bernie",
    file: "assets/bernie.png",
    title: "Доступ к проду",
    caption: "«Я снова прошу у тебя доступ к продакшену». Просто посмотреть.",
    tags: ["код", "работа"],
  },
  {
    id: "change-my-mind",
    file: "assets/change-my-mind.jpg",
    title: "Непопулярное мнение",
    caption: "CSS — это язык программирования. Переубедите меня.",
    tags: ["код", "спор"],
  },
  {
    id: "woman-cat",
    file: "assets/woman-cat.jpg",
    title: "Ты и твой код в 3:00",
    caption: "Код: «я работаю». Ты: «я ничего не менял». Оба орёте.",
    tags: ["код", "ночь"],
  },
  {
    id: "spongebob",
    file: "assets/spongebob.jpg",
    title: "Шутка про дедлайн",
    caption: "«Ха-ха, всё горит» — сказал я и добавил ещё одну зависимость.",
    tags: ["дедлайн", "работа"],
  },
  {
    id: "brain",
    file: "assets/brain.jpg",
    title: "Уровни оптимизации",
    caption: "От «переписать на Rust» до «просто добавить ещё один сервер».",
    tags: ["код", "спор"],
  },
  {
    id: "this-is-fine",
    file: "assets/this-is-fine.jpg",
    title: "Мониторинг",
    caption: "Сервер горит, графики красные, чат молчит. Всё по плану.",
    tags: ["работа", "ночь"],
  },
  {
    id: "roll-safe",
    file: "assets/roll-safe.jpg",
    title: "Уверенность",
    caption: "«Не тестировал, но код точно рабочий» — и палец у виска.",
    tags: ["код", "спор"],
  },
];

/*
 * Общие лайки через бесплатный Abacus API (без регистрации, CORS открыт).
 * Счётчик умеет только +1, поэтому лайк одноразовый: один посетитель = один лайк.
 * localStorage хранит лишь «я уже лайкнул», а число — общее для всех.
 */
const API = {
  base: "https://abacus.jasoncameron.dev",
  ns: "memoteka-live-sistem-2026",
};

const STORAGE_KEY = "memoteka:mylikes:v2";
const COUNT_CACHE_KEY = "memoteka:counts:v2";

const state = {
  query: "",
  tag: "all",
  sort: "default",
  myLikes: loadJSON(STORAGE_KEY, {}),
  counts: loadJSON(COUNT_CACHE_KEY, {}),
  online: false,
};

/* ── хранилище ── */
function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* приватный режим — просто не сохраняем */
  }
}

const likeCount = (id) => Number(state.counts[id]) || 0;
const totalLikes = () => MEMES.reduce((sum, m) => sum + likeCount(m.id), 0);

/* ── API ── */
async function apiFetch(path) {
  const res = await fetch(`${API.base}${path}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function loadCounts() {
  const results = await Promise.allSettled(
    MEMES.map((m) => apiFetch(`/get/${API.ns}/${m.id}`)),
  );

  let any = false;
  results.forEach((r, i) => {
    if (r.status === "fulfilled" && typeof r.value?.value === "number") {
      state.counts[MEMES[i].id] = r.value.value;
      any = true;
    }
  });

  state.online = any;
  if (any) saveJSON(COUNT_CACHE_KEY, state.counts);
  render();
}

async function sendLike(id) {
  const data = await apiFetch(`/hit/${API.ns}/${id}`);
  if (typeof data?.value === "number") {
    state.counts[id] = data.value;
    return data.value;
  }
  return null;
}

/* ── элементы ── */
const $ = (sel) => document.querySelector(sel);
const gallery = $("#gallery");
const empty = $("#empty");
const chips = $("#chips");
const sortBox = $("#sort");
const searchInput = $("#search");
const lightbox = $("#lightbox");
const toastEl = $("#toast");

/* ── теги ── */
const ALL_TAGS = [...new Set(MEMES.flatMap((m) => m.tags))].sort((a, b) => a.localeCompare(b, "ru"));

function renderChips() {
  const items = [{ tag: "all", label: "Все" }, ...ALL_TAGS.map((t) => ({ tag: t, label: `#${t}` }))];
  chips.innerHTML = items
    .map(
      ({ tag, label }) =>
        `<button class="chip${state.tag === tag ? " is-active" : ""}" data-tag="${tag}" type="button">${label}</button>`,
    )
    .join("");
}

chips.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-tag]");
  if (!btn) return;
  state.tag = btn.dataset.tag;
  renderChips();
  render();
});

/* ── фильтрация и сортировка ── */
function visibleMemes() {
  const q = state.query.trim().toLowerCase();
  let list = MEMES.filter((m) => {
    const byTag = state.tag === "all" || m.tags.includes(state.tag);
    const haystack = `${m.title} ${m.caption} ${m.tags.join(" ")}`.toLowerCase();
    return byTag && (!q || haystack.includes(q));
  });

  if (state.sort === "likes") {
    list = [...list].sort((a, b) => likeCount(b.id) - likeCount(a.id) || a.title.localeCompare(b.title, "ru"));
  } else if (state.sort === "az") {
    list = [...list].sort((a, b) => a.title.localeCompare(b.title, "ru"));
  }
  return list;
}

/* ── рендер карточек ── */
function render() {
  const list = visibleMemes();

  gallery.innerHTML = list
    .map(
      (m, i) => `
      <article class="card" data-id="${m.id}" style="animation-delay:${Math.min(i * 45, 400)}ms">
        <button class="like${state.myLikes[m.id] ? " is-liked" : ""}" data-like="${m.id}" type="button"
                title="${state.myLikes[m.id] ? "Ты уже лайкнул" : "Поставить лайк — он общий для всех"}"
                aria-label="Лайкнуть ${m.title}">
          <span aria-hidden="true">${state.myLikes[m.id] ? "♥" : "♡"}</span>
          <span class="like-count">${likeCount(m.id)}</span>
        </button>
        <div class="card-media">
          <img src="${m.file}" alt="${m.title}" loading="lazy" />
        </div>
        <div class="card-body">
          <h3 class="card-title">${m.title}</h3>
          <p class="card-caption">${m.caption}</p>
          <div class="card-tags">${m.tags.map((t) => `<span class="tag">#${t}</span>`).join("")}</div>
        </div>
      </article>`,
    )
    .join("");

  empty.hidden = list.length !== 0;
  updateStats();
}

function updateStats() {
  $("#statMemes").textContent = MEMES.length;
  $("#statTags").textContent = ALL_TAGS.length;
  $("#statLikes").textContent = totalLikes();
}

/* ── лайки (общие) ── */
gallery.addEventListener("click", (e) => {
  const likeBtn = e.target.closest("[data-like]");
  if (likeBtn) {
    e.stopPropagation();
    likeMeme(likeBtn);
    return;
  }
  const card = e.target.closest(".card");
  if (card) openLightbox(card.dataset.id);
});

async function likeMeme(btn) {
  const id = btn.dataset.like;

  if (state.myLikes[id]) {
    toast("Ты уже лайкнул этот мем ♥");
    btn.classList.remove("pop");
    void btn.offsetWidth;
    btn.classList.add("pop");
    return;
  }

  // оптимистично: сразу +1, потом сверяемся с сервером
  state.counts[id] = likeCount(id) + 1;
  state.myLikes[id] = true;
  saveJSON(STORAGE_KEY, state.myLikes);
  saveJSON(COUNT_CACHE_KEY, state.counts);
  paintLike(btn, id);

  try {
    const value = await sendLike(id);
    if (value !== null) {
      state.counts[id] = value;
      saveJSON(COUNT_CACHE_KEY, state.counts);
      paintLike(btn, id);
      toast("Лайк учтён — теперь он общий ♥");
    } else {
      toast("Лайк сохранён локально (сервер не ответил)");
    }
  } catch {
    state.online = false;
    toast("Лайк сохранён локально — сервер недоступен");
  }
}

function paintLike(btn, id) {
  btn.classList.add("is-liked");
  btn.querySelector("span").textContent = "♥";
  btn.querySelector(".like-count").textContent = likeCount(id);
  btn.title = "Ты уже лайкнул";
  btn.classList.remove("pop");
  void btn.offsetWidth;
  btn.classList.add("pop");
  updateStats();
}

/* ── лайтбокс ── */
function openLightbox(id) {
  const m = MEMES.find((x) => x.id === id);
  if (!m) return;

  $("#lbImg").src = m.file;
  $("#lbImg").alt = m.title;
  $("#lbTitle").textContent = m.title;
  $("#lbCaption").textContent = m.caption;
  $("#lbTags").innerHTML = m.tags.map((t) => `<span class="tag">#${t}</span>`).join("");

  lightbox.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  lightbox.hidden = true;
  document.body.style.overflow = "";
}

$("#lbClose").addEventListener("click", closeLightbox);
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) closeLightbox();
});

/* ── поиск ── */
let searchTimer;
searchInput.addEventListener("input", (e) => {
  state.query = e.target.value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(render, 120);
});

/* ── сортировка ── */
sortBox.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-sort]");
  if (!btn) return;
  state.sort = btn.dataset.sort;
  sortBox.querySelectorAll(".chip").forEach((c) => c.classList.toggle("is-active", c === btn));
  render();
});

/* ── случайный мем ── */
$("#randomBtn").addEventListener("click", () => {
  state.query = "";
  state.tag = "all";
  state.sort = "default";
  searchInput.value = "";
  renderChips();
  sortBox.querySelectorAll(".chip").forEach((c) => c.classList.toggle("is-active", c.dataset.sort === "default"));
  render();

  const pool = visibleMemes();
  const pick = pool[Math.floor(Math.random() * pool.length)];
  if (!pick) return;
  openLightbox(pick.id);
  toast(`Сегодняшний мем: «${pick.title}»`);
});

/* ── горячие клавиши ── */
document.addEventListener("keydown", (e) => {
  const typing = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName);
  if (e.key === "Escape") {
    if (!lightbox.hidden) {
      closeLightbox();
      return;
    }
    if (typing) document.activeElement.blur();
    return;
  }
  if (typing) return;
  if (e.key === "/") {
    e.preventDefault();
    searchInput.focus();
  }
  if (e.key.toLowerCase() === "r") {
    e.preventDefault();
    $("#randomBtn").click();
  }
});

/* ── тост ── */
let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1800);
}

/* ── старт ── */
renderChips();
render();
loadCounts();
setInterval(loadCounts, 60000); // подтягивать общие лайки раз в минуту
