// Dr. Pool inbox board - standalone public page (GitHub Pages). No login.
// Reads the board through the Supabase function get_inbox_board() and checks items off
// through inbox_board_toggle(); both only expose / change board fields.
// The hourly scheduled task fills the board from the info@drpool.us inbox.
(function () {
  var SUPABASE_URL = "https://nulgnedluaydgkcqonoh.supabase.co";
  var SUPABASE_KEY = "sb_publishable_hYJ-gUit_qv0jQEZZC7dhw_4Kjl65i6"; // public key; data is protected by RLS
  var TZ = "America/New_York";
  var FRESH_MS = 60 * 60 * 1000;
  var BUCKETS = [
    { key: "action", label: "Needs action", accent: "var(--c-action)" },
    { key: "payments", label: "Payments received", accent: "var(--c-pay)", sum: true },
    { key: "approved", label: "Estimates approved", accent: "var(--c-ok)" },
    { key: "pending", label: "Estimates pending / questions", accent: "var(--c-ask)" },
    { key: "leads", label: "New service requests & leads", accent: "var(--c-lead)" },
    { key: "cancel", label: "Cancellations", accent: "var(--c-cancel)", always: true },
    { key: "complaints", label: "Complaints / service concerns", accent: "var(--c-warn)", always: true },
    { key: "admin", label: "Contracts & property-management admin", accent: "var(--c-admin)" },
    { key: "suppliers", label: "Suppliers, vendors & internal", accent: "var(--c-misc)" }
  ];

  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  var myName = "", items = [], meta = null;
  try { myName = localStorage.getItem("drpool-board-name") || ""; } catch (e) {}

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function toast(msg) { var t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(function () { t.hidden = true; }, 2800); }
  function dayKey(d) { return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d); }
  function fmtTime(iso) {
    var d = new Date(iso); if (isNaN(d)) return "";
    var day = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" }).format(d);
    var tm = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(d);
    return (dayKey(d) === dayKey(new Date()) ? "Today" : day) + " " + tm;
  }
  function ageDays(iso) { var d = new Date(iso); if (isNaN(d)) return 0; return Math.round((Date.parse(dayKey(new Date())) - Date.parse(dayKey(d))) / 86400000); }
  function ts(iso) { var t = Date.parse(iso); return isNaN(t) ? 0 : t; }
  function money(n) { return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function isFresh(it) { return !it.done && Date.now() - ts(it.created_at || it.at) < FRESH_MS; }
  function safeLink(u) { return typeof u === "string" && u.indexOf("https://") === 0 ? u : null; }
  function plain(it) { return it.title + (it.detail ? " - " + it.detail : "") + (it.amount != null ? " (" + money(it.amount) + ")" : "") + " [" + fmtTime(it.at) + "]"; }
  function copy(text, ok) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { toast(ok); }, function () { toast("Could not copy"); });
    else toast("Copy not supported here");
  }

  /* ---------- data ---------- */
  var loading = false;
  function load() {
    if (loading) return; loading = true;
    sb.rpc("get_inbox_board").then(function (r) {
      if (r.error) { $("sweep").textContent = "Could not load the board. Retrying..."; return; }
      var b = r.data || {}; items = Array.isArray(b.items) ? b.items : []; meta = b.meta || null;
      render();
    }).finally(function () { loading = false; });
  }
  function askName() {
    var n = window.prompt("Your name (shows who checked it off):", myName || "");
    if (n == null) return null; n = n.trim().slice(0, 40); if (!n) return null;
    myName = n; try { localStorage.setItem("drpool-board-name", n); } catch (e) {}
    $("who").textContent = "Checking off as " + n; return n;
  }
  function toggle(it) {
    var nowDone = !it.done;
    var by = myName || (nowDone ? askName() : "");
    if (nowDone && !by) return;
    var prev = { done: it.done, done_by: it.done_by, done_at: it.done_at };
    Object.assign(it, nowDone ? { done: true, done_by: by, done_at: new Date().toISOString() } : { done: false, done_by: null, done_at: null });
    render();
    sb.rpc("inbox_board_toggle", { p_id: it.id, p_done: nowDone, p_by: by || null }).then(function (r) {
      if (r.error || r.data === false) { Object.assign(it, prev); render(); toast("Could not save. Try again."); }
    });
  }

  /* ---------- render ---------- */
  function row(it, accent) {
    var fresh = isFresh(it);
    var li = el("li", "item" + (it.done ? " done" : "") + (fresh ? " fresh" : ""));
    li.style.setProperty("--accent", accent);
    var cb = el("button", "check"); cb.type = "button"; cb.setAttribute("role", "checkbox");
    cb.setAttribute("aria-checked", it.done ? "true" : "false"); cb.setAttribute("aria-label", (it.done ? "Reopen: " : "Mark done: ") + it.title);
    cb.addEventListener("click", function () { toggle(it); });
    var main = el("div", "main"), ttl = el("div", "title"), link = safeLink(it.link);
    if (link) { var a = el("a", "mail", it.title); a.href = link; a.target = "_blank"; a.rel = "noopener noreferrer"; ttl.appendChild(a); }
    else ttl.textContent = it.title;
    main.appendChild(ttl);
    if (it.detail) main.appendChild(el("div", "detail", it.detail));
    var m = el("div", "meta");
    if (fresh) m.appendChild(el("span", "newtag", "NEW"));
    m.appendChild(el("span", null, fmtTime(it.at)));
    if (Array.isArray(it.tags) && it.tags.length) m.appendChild(el("span", null, "Tagged: " + it.tags.join(", ")));
    if (it.assigned_to) m.appendChild(el("span", null, "Assigned: " + it.assigned_to));
    var age = ageDays(it.at);
    if (!it.done && age >= 1) m.appendChild(el("span", "old" + (age >= 3 ? " stale" : ""), age === 1 ? "from yesterday" : "still open: " + age + " days"));
    if (it.done) m.appendChild(el("span", null, "done " + (it.done_by ? "by " + it.done_by + " " : "") + fmtTime(it.done_at)));
    main.appendChild(m);
    var side = el("div", "side");
    if (it.amount != null) side.appendChild(el("div", "amt", money(it.amount)));
    if (link) { var o = el("a", "grab open", "Open email"); o.href = link; o.target = "_blank"; o.rel = "noopener noreferrer"; side.appendChild(o); }
    var g = el("button", "grab", "Copy reminder"); g.type = "button";
    g.addEventListener("click", function () { copy(plain(it), "Reminder copied"); });
    side.appendChild(g);
    li.appendChild(cb); li.appendChild(main); li.appendChild(side);
    return li;
  }
  function render() {
    var open = items.filter(function (i) { return !i.done; }).sort(function (a, b) { return ts(b.at) - ts(a.at); });
    var done = items.filter(function (i) { return i.done; }).sort(function (a, b) { return ts(b.done_at) - ts(a.done_at); });
    var host = $("sections"); host.textContent = ""; var payOpen = 0;
    var known = BUCKETS.map(function (b) { return b.key; });
    BUCKETS.concat([{ key: "__other", label: "Other", accent: "var(--c-misc)" }]).forEach(function (b) {
      var list = open.filter(function (i) { return b.key === "__other" ? known.indexOf(i.bucket) < 0 : i.bucket === b.key; });
      if (!list.length && !b.always) return;
      var sec = el("section"); sec.style.setProperty("--accent", b.accent);
      var h = el("h2"); h.appendChild(el("span", null, b.label)); h.appendChild(el("span", "count", list.length ? list.length + " open" : ""));
      if (b.sum && list.length) { var t = 0; list.forEach(function (i) { t += Number(i.amount) || 0; }); payOpen = t; h.appendChild(el("span", "sum", "total " + money(t))); }
      sec.appendChild(h);
      if (!list.length) sec.appendChild(el("p", "none", "None"));
      else { var ul = el("ul"); list.forEach(function (i) { ul.appendChild(row(i, b.accent)); }); sec.appendChild(ul); }
      host.appendChild(sec);
    });
    $("empty").hidden = open.length > 0;
    var st = $("stats"); st.textContent = "";
    function stat(cls, n, label) { var d = el("div", cls); d.appendChild(el("b", null, n)); d.appendChild(document.createTextNode(label)); st.appendChild(d); }
    stat("s-open", String(open.length), "open");
    var fc = open.filter(isFresh).length; if (fc) stat("s-new", String(fc), "new this hour");
    stat("s-action", String(open.filter(function (i) { return i.bucket === "action"; }).length), "need action");
    stat("s-pay", money(payOpen), "payments to log");
    var dl = $("doneList"); dl.textContent = ""; $("tray").hidden = !done.length; $("traySum").textContent = "Done (" + done.length + ")";
    done.forEach(function (i) { dl.appendChild(row(i, "var(--chalk-dim)")); });
    $("sweep").textContent = meta && meta.updatedAt ? "Last sweep " + fmtTime(meta.updatedAt) + (meta.window ? " · covers " + meta.window : "") : "Waiting for the first sweep";
  }
  $("copyAll").addEventListener("click", function () {
    var lines = [];
    BUCKETS.forEach(function (b) {
      var l = items.filter(function (i) { return !i.done && i.bucket === b.key; }); if (!l.length) return;
      lines.push(b.label.toUpperCase()); l.forEach(function (i) { lines.push("- " + plain(i)); });
    });
    copy(lines.length ? "Dr. Pool open items\n" + lines.join("\n") : "Nothing open.", "Open list copied");
  });
  $("who").textContent = myName ? "Checking off as " + myName : "";
  $("who").addEventListener("click", askName);
  $("app").hidden = false;
  load();
  // refresh every minute (picks up the hourly sweep and other people's check-offs; lets the NEW glow expire)
  setInterval(function () { if (document.visibilityState === "visible") load(); }, 60000);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") load(); });
})();
