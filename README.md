# ExpenseVision

#### Description
ExpenseVision is a full-stack expense tracking web application that helps you capture, categorize, analyze, and export your spending. It combines a modern, responsive frontend with a robust Flask backend, SQLite/PostgreSQL database support, OCR-powered receipt scanning via Tesseract (or Veryfi API), AI-enhanced receipt parsing and spending insights via DeepSeek R1 (OpenRouter), and a keyword-driven machine learning classifier that learns from your inputs over time.

The project features a redesigned landing page with smooth CSS animations, a comprehensive dashboard with interactive charts (including empty states for a great first-time user experience), and AI-powered spending analysis that provides personalized, actionable financial insights.

---

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Flask, Python, Gunicorn |
| **Database** | SQLite (local) / PostgreSQL (Supabase, production) |
| **Frontend** | HTML5, CSS3 (custom properties, animations), JavaScript (ES6+) |
| **Charts** | Chart.js 4.x |
| **OCR** | Tesseract (local) / Veryfi API (production) |
| **AI** | DeepSeek R1 0528 via OpenRouter (free tier) |
| **ML** | Simple keyword classifier (learns from user data) |
| **Hosting** | Render (with self-ping keep-alive) |

---

### Project Goals and Scope
- Build a user-friendly expense tracker that runs locally with minimal dependencies.
- Support both manual entry and OCR-based extraction from receipt images.
- AI-enhanced receipt parsing for more accurate data extraction from OCR text.
- AI-powered spending insights that analyze patterns and provide actionable advice.
- Provide useful analytics (by category, monthly, and daily trends) and CSV export.
- Keep the architecture simple, readable, and easy to extend.

---

### File Overview

- `app.py`: Main Flask application. Configures sessions, initializes the database, defines schemas (`users`, `expenses`, `categories`), and exposes JSON endpoints for authentication, expense CRUD, analytics, OCR receipt processing, AI-enhanced parsing, AI spending insights, category prediction, and CSV export. Includes OpenRouter/DeepSeek R1 integration for AI features.

- `templates/login.html`: Landing page with split-screen layout - left side shows project info, features, and tech badges with CSS animations; right side contains tabbed Login/Register forms.

- `templates/dashboard.html`: Single-page application shell for the dashboard. Includes views for Overview (AI insights card, stats, charts with empty states), Expenses (filterable table with improved empty state), Add Expense (manual entry with auto-categorization), and Scan Receipt (OCR upload). Also includes edit modal and theme toggle.

- `static/js/auth.js`: Frontend logic for login and registration flows. Handles tab switching, form submission, error display, and landing page animation triggers.

- `static/js/dashboard.js`: Frontend logic for the dashboard. Handles navigation, data fetching, CRUD operations, OCR processing, chart rendering with empty states, AI insights loading with typing effect, filtering, CSV export, and theme persistence.

- `static/css/style.css`: All styling including green accent theme (`#22c55e`), light/dark themes via CSS custom properties, landing page layout, keyframe animations (fadeInUp, float, shimmer), AI insights card, chart/table empty states, and full responsive design.

- `static/favicon.svg`: Application favicon (receipt icon with sparkle, green theme).

- `requirements.txt`: Python dependencies.

---

### Architecture and Data Flow

```
User -> Landing Page (login/register)
  |
  v
Dashboard
  |-> Manual expense entry -> /api/expenses (POST)
  |-> Receipt scan -> /api/ocr -> Tesseract OCR -> AI parsing (DeepSeek R1) -> /api/expenses
  |-> AI Insights -> /api/ai-insights -> OpenRouter/DeepSeek R1 -> Spending analysis
  |-> Analytics -> /api/analytics -> Chart.js rendering
  |-> Export -> /api/export/csv
```

**AI Integration Flow:**
1. **Receipt Parsing**: After Tesseract extracts raw text, it's sent to DeepSeek R1 via OpenRouter to extract structured data (amount, vendor, date, category, description) more accurately than regex alone. Falls back to regex parsing if AI is unavailable.
2. **Spending Insights**: On-demand analysis triggered by button click. Aggregates user's expense data, sends a summary to DeepSeek R1, and displays personalized insights with a typing effect.

---

### Design Choices and Rationale

- **Flask + SQLite/PostgreSQL**: Simple, portable stack. SQLite for local dev, PostgreSQL (Supabase) for production on Render.
- **Server-side sessions**: Avoids exposing sensitive data in the client.
- **OCR via Tesseract + AI enhancement**: Tesseract handles raw text extraction; DeepSeek R1 provides intelligent parsing of messy OCR output into structured data.
- **DeepSeek R1 (free tier)**: Zero-cost AI via OpenRouter. The model provides strong reasoning capabilities for both receipt parsing and spending analysis.
- **Green accent theme**: Derived from the favicon SVG (`#22c55e`), applied consistently across light and dark modes.
- **Empty states**: Charts and tables show friendly placeholder content when no data exists, improving the first-time user experience.
- **On-demand AI insights**: Triggered by button click rather than auto-loading, to conserve API calls and give users control.

---

### Setup and Running Locally

1. **Install Tesseract** (required for OCR):
   - Windows: Download from [UB Mannheim](https://github.com/UB-Mannheim/tesseract/wiki)
   - macOS: `brew install tesseract`
   - Linux: `sudo apt install tesseract-ocr`

2. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Set environment variables** (optional, for AI features):
   ```bash
   # Required for AI insights and enhanced receipt parsing
   export OPENROUTER_API_KEY=your_openrouter_api_key_here

   # Get a free API key at: https://openrouter.ai/keys
   # The DeepSeek R1 0528 model is free to use
   ```

4. **Run the application**:
   ```bash
   python app.py
   ```

5. **Open** `http://localhost:5000`

On first run, the app creates the database and seeds default categories. AI features (insights and enhanced receipt parsing) require the `OPENROUTER_API_KEY` environment variable; without it, the app works normally using regex-based parsing and the ML classifier.

**Deploying on Render:** Use Start Command `gunicorn --timeout 120 --workers 1 app:app`. On the **free tier**, Render’s proxy has a ~30 second request timeout, so long-running AI insights may return 502 even though the worker allows 120s. If that happens, the UI suggests retrying (the model often succeeds on retry). For reliable long requests, use a paid plan or another host with a longer proxy timeout.

---

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SECRET_KEY` | Recommended | Flask session secret key |
| `OPENROUTER_API_KEY` | For AI features | OpenRouter API key for DeepSeek R1 |
| `DATABASE_URL` | For Postgres | PostgreSQL connection string (Supabase) |
| `VERYFI_CLIENT_ID` | For Veryfi OCR | Veryfi API client ID |
| `VERYFI_USERNAME` | For Veryfi OCR | Veryfi API username |
| `VERYFI_API_KEY` | For Veryfi OCR | Veryfi API key |
| `RENDER` | Auto-set | Set to "true" on Render deployment |
| `RENDER_EXTERNAL_URL` | Auto-set | Used for self-ping keep-alive on Render |

---

### Security and Privacy Notes
- Passwords are stored with secure hashes (Werkzeug). Sessions are server-side.
- Uploaded images are deleted after OCR. All data is local unless you export it.
- Parameterized SQL queries mitigate injection risk. Inputs are validated server-side.
- OpenRouter API calls only send expense summaries (no passwords or personal data).

---

### Limitations and Future Work
- OCR accuracy depends on image quality; AI parsing significantly improves results but requires an API key.
- The keyword-based ML classifier is simple; replacing it with a supervised model would improve accuracy.
- DeepSeek R1 is free but may have latency; responses are cached client-side per session.
- Add budgets, recurring expenses, income tracking, multi-currency support, and richer analytics.
- Add user profile settings, password reset flows, and optional cloud sync.
