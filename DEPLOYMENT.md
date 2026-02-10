# ExpenseVision – Improvements & Deployment

## Improvements made in this repo

- **Security**
  - `SECRET_KEY` is read from the `SECRET_KEY` environment variable (set a strong random value in production).
  - User-supplied text (description, vendor, category) is escaped when rendered in the dashboard to reduce XSS risk.
  - Replaced bare `except:` with `except Exception:` when loading the classifier.
- **Production readiness**
  - Debug mode is off unless `FLASK_DEBUG=true`; port is taken from `PORT` (for Render/Railway).
  - OCR (receipt scanning) is optional: if Tesseract is not installed, the app still runs and the OCR endpoint returns a clear 503 message.
- **Deployment**
  - Added `gunicorn` to `requirements.txt` and a `Procfile` so the app can run on Render, Railway, etc.

## Suggested improvements (optional)

- **Secret key:** In production, set `SECRET_KEY` to a long random string (e.g. `openssl rand -hex 32`).
- **Database:** On free-tier hosts the filesystem is often ephemeral, so SQLite data can be lost on restart. For real persistence, consider a hosted database (e.g. Render PostgreSQL, Railway PostgreSQL) and switch the app to use it.
- **Rate limiting:** Add something like `Flask-Limiter` to limit login/register and API requests.
- **CSRF:** For cookie-based sessions, consider CSRF protection on state-changing requests.
- **Password rules:** Stronger rules (length, complexity) and optional password reset (email).
- **OCR in the cloud:** Receipt scanning in production is supported via **Veryfi** (see below). Alternatively use a platform that supports Tesseract (e.g. Docker with a custom image).
- **Accessibility:** Add `autocomplete="username"` / `autocomplete="current-password"` on login, and manage focus in the edit expense modal.

---

## Deploying online

### Option 1: Render (recommended, free tier)

1. Push your code to GitHub (e.g. [Yogesh-VG0/ExpenseVision](https://github.com/Yogesh-VG0/ExpenseVision)).
2. Go to [render.com](https://render.com) and sign in with GitHub.
3. **New** → **Web Service**.
4. Connect the **ExpenseVision** repo.
5. Use:
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app` (or leave blank if Render detects the Procfile).
   - **Environment:** Add variable `SECRET_KEY` = a long random string (e.g. from [randomkeygen](https://randomkeygen.com/) or `openssl rand -hex 32`).
6. Click **Create Web Service**. Render will build and deploy. Your app will be at `https://<your-service>.onrender.com`.

**Note:** Receipt scanning (OCR) will not work on Render’s default environment — add Veryfi env vars (see Veryfi section below) to enable receipt OCR; free tier 100/month.

### Option 2: Railway

1. Go to [railway.app](https://railway.app) and sign in with GitHub.
2. **New Project** → **Deploy from GitHub repo** → select **ExpenseVision**.
3. In **Variables**, add `SECRET_KEY` with a strong random value.
4. Railway will detect the Procfile and run `gunicorn app:app`. Deploy and use the generated URL.

### Option 3: PythonAnywhere

1. Create a free account at [pythonanywhere.com](https://www.pythonanywhere.com).
2. Open a **Bash** console, clone your repo, and create a virtualenv:
   ```bash
   git clone https://github.com/Yogesh-VG0/ExpenseVision.git
   cd ExpenseVision
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
3. In the **Web** tab, add a new **Web app** (Flask), point it to your project folder and `app.py`.
4. Set **WSGI configuration file** to load `app` (e.g. `application = app.app`).
5. In **Web** → **Environment variables**, set `SECRET_KEY`.

### Option 4: Fly.io (with Docker, for full control and Tesseract)

To support OCR in production you can use a Docker image that includes Tesseract. Example approach:

1. Create a `Dockerfile` that uses a Python image, installs Tesseract, copies the app, and runs `gunicorn app:app`.
2. Deploy with `fly launch` and `fly deploy`.

If you want, a sample `Dockerfile` and `fly.toml` can be added to the repo.

---

## Veryfi: receipt scanning in production

ExpenseVision can use [Veryfi](https://www.veryfi.com/) so receipt scanning works on Render/Railway without installing Tesseract.

1. Sign up at [Veryfi](https://www.veryfi.com/) and get API credentials (Hub → API Keys).
2. In your host’s **Environment** (e.g. Render → Environment), add:

| Variable            | Description |
|---------------------|-------------|
| `VERYFI_CLIENT_ID`  | Your Veryfi Client ID. |
| `VERYFI_USERNAME`   | Your Veryfi API username. |
| `VERYFI_API_KEY`    | Your Veryfi API key. |

3. Redeploy. The app will use Veryfi for `/api/ocr` when these are set; otherwise it uses Tesseract if available, or returns a clear error.

**Pricing (Veryfi):** Free tier = 100 receipts/month; then paid per document (e.g. $0.08/receipt on Starter). See [Veryfi pricing](https://www.veryfi.com/).

---

## Environment variables (production)

| Variable             | Required | Description |
|----------------------|----------|-------------|
| `SECRET_KEY`         | Yes      | Long random string for session signing. |
| `VERYFI_CLIENT_ID`   | No       | For receipt OCR in production (Veryfi). |
| `VERYFI_USERNAME`    | No       | Veryfi API username. |
| `VERYFI_API_KEY`     | No       | Veryfi API key. |
| `PORT`               | No       | Set by Render/Railway automatically. |
| `FLASK_DEBUG`        | No       | Set to `true` only for local debugging. |

---

## After deploying

- Use **HTTPS** only (Render/Railway provide it by default).
- Do not set `FLASK_DEBUG=true` in production.
- If you add a persistent database later, set `DATABASE_URL` (or similar) and update `app.py` to use it instead of a local SQLite file.
