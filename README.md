# Audit Teknikal Ambulans — Web App (JKN Kedah)

Digital version of `AUDIT_TEKNIKAL_AMBULANS.docx`. Google Sheets stores
the data, Google Apps Script (GAS) is the backend API, and GitHub
Pages hosts the frontend (the part everyone visits in their browser).

**Quick map of where each file goes:**

| File / folder | Goes to | What it does |
|---|---|---|
| `google-apps-script/Code.gs` | **Pasted into Apps Script** (inside your Google Sheet) | Backend: saves audits, uploads photos to Drive, serves dropdown & dashboard data |
| Everything else (`index.html`, `form.html`, `dashboard.html`, `assets/`, `.github/`) | **Pushed to GitHub** | Frontend: what auditors actually see and use, hosted free on GitHub Pages |

`Code.gs` and the rest of the project are two **separate** places —
nothing in `assets/`, `index.html`, `form.html` or `dashboard.html`
goes into Apps Script, and `Code.gs` does not go into GitHub.

---

## Part 1 — Google Sheet + Apps Script (backend)

1. Create a new Google Sheet (sheets.new). Name it e.g. `Data Audit Ambulans`.
2. In the Sheet, go to **Extensions ▸ Apps Script**. This opens an editor bound to this Sheet.
3. Delete any starter code in `Code.gs`, then paste in the entire contents of `google-apps-script/Code.gs` from this project.
4. Save (Ctrl/Cmd+S). In the function dropdown at the top, choose **`setupSheets`** and click **Run** (▶). The first time, Google will ask you to authorize the script — accept it (it's your own script, on your own Sheet).
5. Go back to the Sheet — you'll now see three tabs: `Audits`, `AuditDetails`, `MasterData`.
6. Open the **MasterData** tab. The 12 Kedah daerah are pre-filled. Add your real klinik underneath — one row per klinik, with the matching daerah name in column A. Delete the "KK CONTOH" sample row. You can keep editing this list any time, even after the app is live — no code or redeploy needed.
7. Create (or pick) a Google Drive folder for audit photos. Open it and copy the **folder ID** from its URL: `drive.google.com/drive/folders/`**`THIS_PART`**.
8. Back in the Apps Script editor: **Project Settings** (gear icon, left sidebar) ▸ scroll to **Script Properties** ▸ **Add script property**, and add all three:

   | Property | Value |
   |---|---|
   | `SHARED_TOKEN` | any long random string you make up, e.g. `kdh-ambu-7x9P2qLr` |
   | `DASHBOARD_PIN` | a 4-digit PIN for the state dashboard, e.g. `2468` |
   | `DRIVE_FOLDER_ID` | the folder ID from step 7 |

   **Write `SHARED_TOKEN` down — you'll need the exact same value again in Part 2.**

9. Back in the editor: **Deploy ▸ New deployment ▸** gear icon ▸ select type **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy**, authorize again if asked, then **copy the Web app URL**. It looks like `https://script.google.com/macros/s/AKfycb.../exec`.

That URL + the `SHARED_TOKEN` are the two values the frontend needs — but they go into GitHub as **Secrets**, never into a file you can see in the repo. That's Part 2.

> Whenever you edit `Code.gs` later, you must **Deploy ▸ Manage deployments ▸ ✏️ ▸ New version** for changes to go live. The URL stays the same.

---

## Part 2 — GitHub (frontend)

1. Create a new **public or private** GitHub repository (private is fine — GitHub Pages works on private repos too if your account supports it, otherwise make it public).
2. Push every file in this project **except** `assets/js/config.js` (it doesn't exist yet — that's expected, see `.gitignore`).
3. In the repo: **Settings ▸ Secrets and variables ▸ Actions ▸ New repository secret**, add:

   | Name | Value |
   |---|---|
   | `GAS_URL` | the Web app URL from Part 1, step 9 |
   | `SHARED_TOKEN` | the exact same string you put in Script Properties |

4. **Settings ▸ Pages** ▸ under **Build and deployment ▸ Source**, choose **GitHub Actions**.
5. Push to the `main` branch (or go to the **Actions** tab and run the "Deploy to GitHub Pages" workflow manually). Watch it go green.
6. Your site is now live at `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`.

This is the step that keeps the GAS URL out of `index.html`: the workflow writes it into `assets/js/config.js` only during this build, and that file is never committed to your repository (see the honesty note below on what this does and doesn't protect against).

### Adding your logo

Upload your logo as `assets/img/logo.png` (square works best, ~256×256px). The header on every page already looks for it — no code changes needed. A small favicon at `assets/img/favicon.png` is optional.

---

## Using the app day-to-day

- **Auditors:** open the site URL → pick **Borang Auditor 1** or **Borang Auditor 2** → fill in Maklumat Am (Daerah/Klinik dropdowns, Nama PPP, Nama Auditor — these two are forced to UPPERCASE as you type) → answer the 30 questions in three steps (A, B, C) → review → Hantar Audit → download the PDF if needed.
- **State-level staff:** open `dashboard.html` (link at the bottom of the homepage), enter the 4-digit PIN, see KPIs, charts (score by daerah, category breakdown, trend over time, most-failed questions) and the full audit list.
- **Photos:** each question has its own "+ Tambah Foto" button (opens the camera on mobile). Photos are compressed in the browser, then saved to your Drive folder by Apps Script when the form is submitted.
- **PDF naming:** `KLINIK-AUDITOR_NAME-YYYY-MM-DD.pdf`, generated entirely in the browser.

---

## Honest note on "keeping the GAS URL safe"

GitHub Pages is a static host — there's no server of yours sitting between the browser and Apps Script. What this setup actually achieves:

- The URL and token are **not in your repository's source code or git history** — so they won't show up if someone browses your public repo or a bot scans GitHub for leaked keys.
- Apps Script will **reject any request without the correct `SHARED_TOKEN`**, so the URL alone isn't enough to submit fake audits or read the dashboard.
- The dashboard additionally requires the 4-digit `DASHBOARD_PIN`.

What it does **not** do: once the page is open in a browser, anyone who opens DevTools ▸ Network can see the URL and token being sent, because the browser itself has to send them to talk to Apps Script. There's no way to fully hide that in a backend-less, static-hosting setup — only a real server in between could do that, which is a much bigger project than what was asked for here. For an internal JKN tool distributed by direct link, this level of protection is the realistic, standard approach.

---

## Known limitations / things to know

- **Digital signature:** intentionally not built yet, per your instruction.
- **Photos in the PDF:** not embedded as images (Drive links don't reliably allow cross-origin embedding) — each photo is a tappable link in an appendix page instead.
- **Auditor 1 / Auditor 2:** stored as two independent submissions, shown side-by-side in the dashboard table. No automatic averaging is done, per your choice.
- **MasterData (Daerah/Klinik):** lives in the Sheet, not hardcoded, so you can keep it accurate without touching code.
- **Apps Script quotas:** free Google accounts have daily limits (URL fetch/script runtime). Fine for normal audit volumes; worth knowing if usage grows a lot.

---

## Testing locally before pushing

`assets/js/config.sample.js` → copy to `assets/js/config.js`, fill in your real `GAS_URL`/`SHARED_TOKEN`, then open the folder with a local server (e.g. the VS Code "Live Server" extension, or run `npx serve` in the folder). Opening `index.html` directly by double-clicking can cause the browser to block the API calls — always test through `http://localhost`.
