"""
BrightScheduler (FastAPI App)
Sections:
  1) Imports & App
  2) Config & Constants
  3) Core Helpers
  4) UI Routes (public, worker, admin)
  5) API Routes
  6) Ops / Cron / Health
"""

# 1) IMPORTS & APP ------------------------------------------------------------
import os, io, csv, requests
import datetime as dt
from datetime import datetime, timedelta
from typing import List, Dict, Tuple
from collections import defaultdict, Counter

from fastapi import FastAPI, UploadFile, File, Form, Query
from fastapi.responses import HTMLResponse, JSONResponse

app = FastAPI()


# 2) CONFIG & CONSTANTS -------------------------------------------------------
# In-memory roster rows: [name, date, shift, status, role, site]
SHIFTS: List[List[str]] = []

REQUIRED_COLUMNS = ["name", "date", "shift", "status", "role", "site"]
ALLOWED_SHIFT = {"Day", "Evening", "Night"}
ALLOWED_STATUS = {"ok", "late", "sick", "absent"}

# Staffing requirement per shift (role counts)
REQUIRED: Dict[Tuple[str, str], int] = {
    ("Day", "RN"): 2, ("Day", "HCA"): 4,
    ("Evening", "RN"): 1, ("Evening", "HCA"): 3,
    ("Night", "RN"): 1, ("Night", "HCA"): 2,
}


# 3) CORE HELPERS -------------------------------------------------------------
def compute_coverage(rows: List[List[str]]) -> Dict[Tuple[str, str, str], dict]:
    """
    Returns a mapping:
      (date, site, shift) -> {
        'need': {'RN': int, 'HCA': int},
        'have': {'RN': int, 'HCA': int},
        'rag': 'green'|'amber'|'red'
      }
    """
    bucket = defaultdict(list)
    for n, d, s, st, r, site in rows:
        bucket[(d, site, s)].append({"name": n, "status": st, "role": r})

    out = {}
    for key, members in bucket.items():
        d, site, s = key
        present = Counter(m["role"] for m in members if m["status"] not in {"absent", "sick"})
        need_rn  = REQUIRED.get((s, "RN"), 0)
        need_hca = REQUIRED.get((s, "HCA"), 0)
        have_rn  = present.get("RN", 0)
        have_hca = present.get("HCA", 0)
        worst = min(have_rn - need_rn, have_hca - need_hca)
        rag = "green" if worst >= 0 else ("amber" if worst == -1 else "red")
        out[key] = {
            "need": {"RN": need_rn, "HCA": need_hca},
            "have": {"RN": have_rn, "HCA": have_hca},
            "rag": rag
        }
    return out


def daily_rag_counts(cov: Dict[Tuple[str, str, str], dict]) -> Dict[str, Dict[str, int]]:
    """
    Aggregate RAG counts for the last 7 UTC days (by date string).
    """
    today = datetime.utcnow().date()
    window = {(today - timedelta(days=i)).isoformat() for i in range(7)}
    out: Dict[str, Dict[str, int]] = {}

    for (d, site, s), c in cov.items():
        ds = str(d)
        if ds not in window:
            continue
        bucket = out.setdefault(ds, {"green": 0, "amber": 0, "red": 0})
        bucket[c["rag"]] += 1

    # force an ordered map latest->earliest
    ordered: Dict[str, Dict[str, int]] = {}
    for i in range(7):
        ds = (today - timedelta(days=i)).isoformat()
        ordered[ds] = out.get(ds, {"green": 0, "amber": 0, "red": 0})
    return ordered


def _format_rag_html(cov: Dict[Tuple[str, str, str], dict]) -> str:
    cards = []
    for (d, site, s), c in sorted(cov.items()):
        color = {"green": "#1f6f43", "amber": "#b88715", "red": "#9b1c1c"}[c["rag"]]
        txt = (
            f"{d} • {site} • {s} — "
            f"RN {c['have']['RN']}/{c['need']['RN']}, "
            f"HCA {c['have']['HCA']}/{c['need']['HCA']} → {c['rag'].upper()}"
        )
        cards.append(
            f"<div style='background:{color};color:white;padding:8px 10px;"
            f"border-radius:6px;margin:6px 0'>{txt}</div>"
        )
    return "".join(cards) if cards else "<p>No roster uploaded yet.</p>"


def _worker_rows(name: str) -> List[List[str]]:
    n = name.strip().lower()
    return [r for r in SHIFTS if r[0].strip().lower() == n]


def _set_status(name: str, day: str, shift: str, new_status: str) -> bool:
    changed = False
    for i, (n, d, s, st, r, site) in enumerate(SHIFTS):
        if n.strip().lower() == name.strip().lower() and d == day and s == shift:
            SHIFTS[i] = [n, d, s, new_status, r, site]
            changed = True
    return changed


def _send_email_resend(to_addr: str, subject: str, html: str) -> dict:
    """
    Send via Resend API. Set env:
      RESEND_API_KEY=xxxxxxxx
    """
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        return {"ok": False, "error": "RESEND_API_KEY missing"}

    r = requests.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "from": "BrightScheduler <onboarding@resend.dev>",  # replace with your verified domain
            "to": [to_addr],
            "subject": subject,
            "html": html
        },
        timeout=20
    )
    try:
        r.raise_for_status()
        return {"ok": True, "id": r.json().get("id")}
    except Exception as e:
        return {"ok": False, "error": str(e), "status": r.status_code, "body": r.text}


# 4) UI ROUTES (public, worker, admin) ---------------------------------------
@app.get("/", response_class=HTMLResponse)
def home():
    return """
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <div style="font-family:system-ui;max-width:640px;margin:24px auto;padding:16px">
      <h1>BrightScheduler</h1>
      <p>Upload roster → See shifts → Coverage RAG</p>

      <form action="/upload" method="post" enctype="multipart/form-data" style="margin:12px 0">
        <input type="file" name="file" accept=".csv" required>
        <label style="margin-left:8px">
          <input type="checkbox" name="replace" value="1"> Replace existing roster (instead of adding)
        </label>
        <button type="submit" style="margin-left:8px">Upload roster CSV</button>
      </form>

      <p>
        <a href="/shifts">View shifts</a> •
        <a href="/dashboard">Dashboard (7 days)</a> •
        <a href="/m">Worker view</a> •
        <a href="/admin/workers">Admin workers</a>
      </p>
    </div>
    """


@app.post("/upload")
async def upload(file: UploadFile = File(...), replace: str | None = Form(None)):
    raw = await file.read()
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    cols = [c.strip() for c in (reader.fieldnames or [])]
    missing = [c for c in REQUIRED_COLUMNS if c not in cols]
    extra = [c for c in cols if c not in REQUIRED_COLUMNS]

    errors = []
    if missing:
        errors.append(f"Missing columns: {', '.join(missing)}")
    if extra:
        errors.append(f"Ignoring extra columns: {', '.join(extra)}")

    rows, n = [], 0
    for i, row in enumerate(reader, start=2):  # header = line 1
        n += 1
        r = {k: (row.get(k, "") or "").strip() for k in REQUIRED_COLUMNS}
        if r["shift"] not in ALLOWED_SHIFT:
            errors.append(f"Line {i}: shift must be one of {sorted(ALLOWED_SHIFT)}")
        if r["status"].lower() not in ALLOWED_STATUS:
            errors.append(f"Line {i}: status must be one of {sorted(ALLOWED_STATUS)}")
        rows.append([r["name"], r["date"], r["shift"], r["status"].lower(), r["role"], r["site"]])

    if missing or (len(errors) and n == 0):
        return HTMLResponse(
            "<div style='font-family:system-ui;max-width:600px;margin:24px auto'>"
            "<h3>Upload failed</h3>"
            f"<p>{'<br>'.join(errors)}</p>"
            "<p><a href='/'>← Try again</a></p></div>",
            status_code=400
        )

    global SHIFTS
    if replace == "1":
        SHIFTS = rows          # replace
    else:
        SHIFTS.extend(rows)    # append

    # simple redirect
    return HTMLResponse("<meta http-equiv='refresh' content='0; url=/shifts'>Uploading…")


@app.get("/shifts", response_class=HTMLResponse)
def shifts():
    if not SHIFTS:
        return """
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <div style="font-family:system-ui;max-width:860px;margin:24px auto;padding:16px">
          <a href="/">← Back</a>
          <h2>Shifts</h2><p>No roster uploaded yet.</p>
        </div>"""

    cov = compute_coverage(SHIFTS)
    cards = []
    for (d, site, s), c in sorted(cov.items()):
        color = {"green": "#1f6f43", "amber": "#b88715", "red": "#9b1c1c"}[c["rag"]]
        txt = f"{d} • {site} • {s} — RN {c['have']['RN']}/{c['need']['RN']}, HCA {c['have']['HCA']}/{c['need']['HCA']} → {c['rag'].upper()}"
        cards.append(
            f"<div style='background:{color};color:white;padding:8px 10px;border-radius:8px;margin:6px 0'>{txt}</div>"
        )

    rows = "".join(
        f"<tr><td>{n}</td><td>{d}</td><td>{s}</td>"
        f"<td style='color:{'red' if st in ['sick','absent'] else 'inherit'}'>{st}</td>"
        f"<td>{r}</td><td>{site}</td></tr>"
        for n, d, s, st, r, site in SHIFTS
    )

    return f"""
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <div style="font-family:system-ui;max-width:860px;margin:24px auto;padding:16px">
      <a href="/">← Back</a>
      <h2>Shift Coverage</h2>
      {''.join(cards)}
      <h3 style="margin-top:18px">Roster Detail</h3>
      <table border=1 cellpadding=6>
        <tr><th>Name</th><th>Date</th><th>Shift</th><th>Status</th><th>Role</th><th>Site</th></tr>
        {rows}
      </table>

      <h3 style="margin-top:22px">Add another CSV</h3>
      <form action="/upload" method="post" enctype="multipart/form-data" style="margin:8px 0">
        <input type="file" name="file" accept=".csv" required>
        <label style="margin-left:8px">
          <input type="checkbox" name="replace" value="1"> Replace existing roster (instead of adding)
        </label>
        <button type="submit" style="margin-left:8px">Upload</button>
      </form>
      <p style="opacity:.7">Tip: leave “Replace” unchecked to combine multiple days.</p>
    </div>
    """


@app.get("/dashboard", response_class=HTMLResponse)
def dashboard():
    cov = compute_coverage(SHIFTS) if SHIFTS else {}
    daily = daily_rag_counts(cov)

    total_g = sum(v["green"] for v in daily.values())
    total_a = sum(v["amber"] for v in daily.values())
    total_r = sum(v["red"] for v in daily.values())

    rows_html = ""
    for ds, v in daily.items():
        bar = (
            f"<span style='background:#1f6f43;color:white;padding:2px 6px;border-radius:6px'>{v['green']}</span> "
            f"<span style='background:#b88715;color:white;padding:2px 6px;border-radius:6px'>{v['amber']}</span> "
            f"<span style='background:#9b1c1c;color:white;padding:2px 6px;border-radius:6px'>{v['red']}</span>"
        )
        rows_html += f"<tr><td>{ds}</td><td style='text-align:center'>{bar}</td></tr>"

    return f"""
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <div style="font-family:system-ui;max-width:900px;margin:24px auto;padding:16px">
      <a href="/">← Back</a>
      <h2>Coverage Dashboard (Last 7 Days)</h2>

      <div style="display:flex;gap:10px;margin:10px 0 18px">
        <div style="background:#1f6f43;color:white;padding:8px 10px;border-radius:10px">Green: <b>{total_g}</b></div>
        <div style="background:#b88715;color:white;padding:8px 10px;border-radius:10px">Amber: <b>{total_a}</b></div>
        <div style="background:#9b1c1c;color:white;padding:8px 10px;border-radius:10px">Red: <b>{total_r}</b></div>
      </div>

      <table border=1 cellpadding=8 cellspacing=0 style="width:100%;border-collapse:collapse">
        <tr><th style="width:160px">Date</th><th>Green / Amber / Red (count of site×shift)</th></tr>
        {rows_html}
      </table>

      <p style="opacity:.7;margin-top:12px">Tip: upload rosters for multiple dates to populate the trend.</p>
    </div>
    """


@app.get("/m", response_class=HTMLResponse)
def mobile(
    name: str = Query("", description="Worker full name"),
    days: int = Query(7, ge=1, le=14, description="How many days to show (including today)"),
    include_off: int = Query(1, description="1=show off-days, 0=hide")
):
    # Use PH "today" (UTC+8)
    today = (dt.datetime.utcnow() + dt.timedelta(hours=8)).date()
    today_iso = today.isoformat()
    end_date = today + dt.timedelta(days=days - 1)  # inclusive window

    if not name:
        return """
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <div style="font-family:system-ui;max-width:480px;margin:24px auto;padding:16px">
          <h2>Find your roster</h2>
          <form method="get" action="/m" style="display:flex;gap:8px">
            <input name="name" placeholder="Full name" style="flex:1;padding:10px" required>
            <button type="submit">Open</button>
          </form>
          <p style="opacity:.7;margin-top:10px">Example: Anna Cruz</p>
        </div>
        """

    rows = _worker_rows(name)
    cov = compute_coverage(SHIFTS)

    def dparse(s: str): return dt.datetime.fromisoformat(s).date()

    by_day = defaultdict(list)
    for (n, d, sh, st, r, site) in rows:
        dd = dparse(d)
        if today <= dd <= end_date:
            by_day[d].append((n, d, sh, st, r, site))

    date_list = [(today + dt.timedelta(days=i)).isoformat() for i in range(days)]
    if not include_off:
        date_list = [d for d in date_list if d in by_day]

    def badge(txt, bg):
        return f"<span style='background:{bg};color:white;padding:2px 8px;border-radius:999px;font-size:12px'>{txt}</span>"

    def status_pill(st):
        return badge(st.upper(), {"ok":"#1f6f43","late":"#b88715","sick":"#9b1c1c","absent":"#9b1c1c"}.get(st, "#555"))

    def coverage_badge(d, site, sh):
        info = cov.get((d, site, sh))
        if not info:
            return "<div style='opacity:.6'>No coverage data.</div>"
        color = {"green":"#1f6f43","amber":"#b88715","red":"#9b1c1c"}[info["rag"]]
        txt = f"Team: RN {info['have']['RN']}/{info['need']['RN']}, HCA {info['have']['HCA']}/{info['need']['HCA']} → {info['rag'].upper()}"
        return f"<div style='background:{color};color:white;padding:6px 10px;border-radius:8px;margin-top:6px'>{txt}</div>"

    sections = ""
    for day in date_list:
        label = "Today" if day == today_iso else day
        items = sorted(by_day.get(day, []), key=lambda x: (x[2], x[5], x[4]))  # shift, site, role
        sections += f"<h4 style='margin:12px 0 6px'>{label}</h4>"

        if not items:
            sections += (
                "<div style='padding:10px;border:1px dashed #ccc;border-radius:10px;margin:6px 0;opacity:.75'>"
                "No shift scheduled</div>"
            )
        else:
            for (n, d, sh, st, r, site) in items:
                sections += f"""
                  <div style="padding:10px;border:1px solid #eee;border-radius:10px;margin:6px 0">
                    <div>{site} — {sh} — {r} &nbsp; {status_pill(st)}</div>
                    {coverage_badge(d, site, sh)}
                    <div style="margin-top:6px">
                      <form method='post' action='/api/status' style='display:inline'>
                        <input type='hidden' name='name' value='{name}'/>
                        <input type='hidden' name='date' value='{d}'/>
                        <input type='hidden' name='shift' value='{sh}'/>
                        <input type='hidden' name='status' value='sick'/>
                        <button type='submit' style='margin:4px 6px'>I’m Sick</button>
                      </form>
                      <form method='post' action='/api/status' style='display:inline'>
                        <input type='hidden' name='name' value='{name}'/>
                        <input type='hidden' name='date' value='{d}'/>
                        <input type='hidden' name='shift' value='{sh}'/>
                        <input type='hidden' name='status' value='late'/>
                        <button type='submit' style='margin:4px 6px'>I’m Late</button>
                      </form>
                      <form method='post' action='/api/status' style='display:inline'>
                        <input type='hidden' name='name' value='{name}'/>
                        <input type='hidden' name='date' value='{d}'/>
                        <input type='hidden' name='shift' value='{sh}'/>
                        <input type='hidden' name='status' value='ok'/>
                        <button type='submit' style='margin:4px 6px'>I’m Back</button>
                      </form>
                    </div>
                  </div>
                """

    if not sections:
        sections = "<p style='opacity:.7'>No shifts in this window.</p>"

    return f"""
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <div style="font-family:system-ui;max-width:560px;margin:12px auto;padding:12px">
      <h2 style="margin:6px 0">{name}</h2>
      <h3 style="margin-top:8px">Next {days} day(s)</h3>
      {sections}
      <p style="opacity:.6;margin-top:16px">
        Quick: <a href="/m?name={name}&days=3">3</a> ·
        <a href="/m?name={name}&days=5">5</a> ·
        <a href="/m?name={name}&days=7">7</a> days
        • <a href="/m?name={name}&days={days}&include_off=0">hide off-days</a>
        &nbsp;•&nbsp; <a href="/">Admin</a>
      </p>
    </div>
    """


# ---- Admin: worker directory ----
@app.get("/admin/workers", response_class=HTMLResponse)
def admin_workers():
    if not SHIFTS:
        return """
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <div style="font-family:system-ui;max-width:720px;margin:24px auto;padding:16px">
          <a href="/">← Back</a>
          <h2>Admin · Workers</h2>
          <p>No roster loaded yet.</p>
        </div>"""
    names = sorted({n for (n, *_rest) in SHIFTS}, key=lambda s: s.lower())
    links = "".join(
        f"<li><a href='/admin/worker?name={n.replace(' ', '%20')}&days=7'>{n}</a></li>"
        for n in names
    )
    return f"""
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <div style="font-family:system-ui;max-width:720px;margin:24px auto;padding:16px">
      <a href="/">← Back</a>
      <h2>Admin · Workers</h2>
      <ul>{links}</ul>
    </div>
    """


# ---- Admin: 7-day worker view ----
@app.get("/admin/worker", response_class=HTMLResponse)
def admin_worker(
    name: str = Query("", description="Worker full name"),
    days: int = Query(7, ge=1, le=14),
    include_off: int = Query(1, description="1=show off-days, 0=hide")
):
    # PH "today" (UTC+8)
    today = (dt.datetime.utcnow() + dt.timedelta(hours=8)).date()
    today_iso = today.isoformat()
    end_date = today + dt.timedelta(days=days - 1)

    if not name:
        return """
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <div style="font-family:system-ui;max-width:760px;margin:24px auto;padding:16px">
          <a href="/admin/workers">← Workers</a>
          <h2>Admin · Worker</h2>
          <p>Missing ?name=... param.</p>
        </div>"""

    rows = _worker_rows(name)
    cov = compute_coverage(SHIFTS)

    def dparse(s: str): return dt.datetime.fromisoformat(s).date()

    by_day = defaultdict(list)
    for (n, d, sh, st, r, site) in rows:
        dd = dparse(d)
        if today <= dd <= end_date:
            by_day[d].append((n, d, sh, st, r, site))

    date_list = [(today + dt.timedelta(days=i)).isoformat() for i in range(days)]
    if not include_off:
        date_list = [d for d in date_list if d in by_day]

    def badge(txt, bg):
        return f"<span style='background:{bg};color:white;padding:2px 8px;border-radius:999px;font-size:12px'>{txt}</span>"

    def rag_bar(info):
        color = {"green":"#1f6f43","amber":"#b88715","red":"#9b1c1c"}[info["rag"]]
        txt = f"RN {info['have']['RN']}/{info['need']['RN']} · HCA {info['have']['HCA']}/{info['need']['HCA']} → {info['rag'].upper()}"
        return f"<div style='background:{color};color:white;padding:6px 10px;border-radius:8px;margin-top:6px'>{txt}</div>"

    def status_select(n, d, sh, current):
        opts = []
        for s in ["ok", "late", "sick", "absent"]:
            sel = " selected" if s == current else ""
            opts.append(f"<option value='{s}'{sel}>{s.upper()}</option>")
        return (
            f"<form method='post' action='/api/status' style='display:flex;gap:8px;align-items:center;margin-top:6px'>"
            f"<input type='hidden' name='name' value='{n}'/>"
            f"<input type='hidden' name='date' value='{d}'/>"
            f"<input type='hidden' name='shift' value='{sh}'/>"
            f"<select name='status'>{''.join(opts)}</select>"
            f"<button type='submit'>Update</button>"
            f"</form>"
        )

    sections = ""
    for day in date_list:
        label = "Today" if day == today_iso else day
        items = sorted(by_day.get(day, []), key=lambda x: (x[2], x[5], x[4]))  # shift, site, role
        sections += f"<h4 style='margin:12px 0 6px'>{label}</h4>"

        if not items:
            sections += "<div style='padding:10px;border:1px dashed #ccc;border-radius:10px;margin:6px 0;opacity:.75'>No shift scheduled</div>"
        else:
            for (n, d, sh, st, r, site) in items:
                info = cov.get((d, site, sh))
                suggestions = ""
                if info:
                    if info["rag"] == "red":
                        suggestions = "<div style='margin-top:6px;opacity:.85'>Suggest: notify admin, broadcast open shift, page casual pool.</div>"
                    elif info["rag"] == "amber":
                        suggestions = "<div style='margin-top:6px;opacity:.85'>Suggest: soft alert to team lead; prep standby list.</div>"

                sections += f"""
                <div style="padding:12px;border:1px solid #e5e5e5;border-radius:10px;margin:6px 0">
                  <div><b>{site}</b> — {sh} — {r} &nbsp; {badge(st.upper(), '#1f6f43' if st=='ok' else '#b88715' if st=='late' else '#9b1c1c')}</div>
                  {rag_bar(info) if info else "<div style='opacity:.6'>No coverage data.</div>"}
                  {status_select(n, d, sh, st)}
                  {suggestions}
                </div>
                """

    if not sections:
        sections = "<p style='opacity:.7'>No shifts in this window.</p>"

    return f"""
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <div style="font-family:system-ui;max-width:760px;margin:16px auto;padding:16px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <a href="/admin/workers">← Workers</a>
          <h2 style="margin:6px 0 0">Admin · {name}</h2>
          <div style="opacity:.7">Today → {days} day(s)</div>
        </div>
        <div><a href="/m?name={name}&days={days}" style="text-decoration:none">Open worker view</a></div>
      </div>
      <div style="margin:12px 0;opacity:.8">
        Quick: <a href="/admin/worker?name={name}&days=3">3</a> ·
        <a href="/admin/worker?name={name}&days=5">5</a> ·
        <a href="/admin/worker?name={name}&days=7">7</a> days &nbsp;|&nbsp;
        <a href="/admin/worker?name={name}&days={days}&include_off=0">hide off-days</a>
      </div>
      {sections}
    </div>
    """


# 5) API ROUTES ---------------------------------------------------------------
@app.post("/api/status")
async def set_status(
    name: str = Form(...),
    date: str = Form(...),
    shift: str = Form(...),
    status: str = Form(...)
):
    status = status.lower().strip()
    if status not in {"ok", "late", "sick", "absent"}:
        return JSONResponse({"ok": False, "error": "Invalid status"}, status_code=400)
    _set_status(name, date, shift, status)
    dest = f"/m?name={name}"
    return HTMLResponse(f"<meta http-equiv='refresh' content='0; url={dest}'>Updating…", status_code=200)


# 6) OPS / CRON / HEALTH ------------------------------------------------------
@app.get("/cron/daily-rag")
def daily_rag():
    cov = compute_coverage(SHIFTS) if SHIFTS else {}
    today_ph = dt.datetime.utcnow() + dt.timedelta(hours=8)  # simple PH time (UTC+8)
    subject = f"BrightScheduler RAG — {today_ph.strftime('%Y-%m-%d')} (PH)"
    html = f"""
    <div style="font-family:system-ui;max-width:700px;margin:16px auto">
      <h2 style="margin:0 0 8px">Daily Coverage Summary</h2>
      <div style="opacity:.7;margin:0 0 12px">{subject}</div>
      {_format_rag_html(cov)}
      <p style="opacity:.7;margin-top:16px">Automated mail from BrightScheduler.</p>
    </div>
    """
    to_addr = os.environ.get("RAG_TO_EMAIL", "")
    if not to_addr:
        return {"ok": False, "error": "RAG_TO_EMAIL not set", "preview_html": html}
    res = _send_email_resend(to_addr, subject, html)
    return {"to": to_addr, **res}


@app.get("/health")
def health():
    return {"ok": True}



