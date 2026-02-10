# ExpenseVision

#### Video Demo: https://youtu.be/Y1CeMCh7we0

#### Description
ExpenseVision is a full‑stack expense tracking web application that helps you capture, categorize, analyze, and export your spending. It combines a clean, responsive frontend, a robust Flask backend, an embedded SQLite database, OCR‑powered receipt scanning via Tesseract, and a simple keyword‑driven machine learning classifier that learns from your inputs over time. The result is a practical tool that makes it easy to log purchases manually or from photos of receipts, visualize your spending patterns, and export your data for further analysis.

The project was designed with an emphasis on usability and maintainability: a single page dashboard organizes day‑to‑day tasks (adding and editing expenses, scanning receipts, filtering/searching your history) while an analytics overview summarizes your totals by category and month. For convenience, ExpenseVision can run locally with minimal setup on Windows, macOS, Linux, or CS50.dev. All data is stored locally in `expensevision.db`, and uploaded receipt images are removed immediately after OCR processing.

At a high level, ExpenseVision works like this: the frontend calls RESTful JSON endpoints on the Flask server to create, read, update, and delete expenses and to fetch aggregated analytics. When you upload a receipt image, the backend uses Pillow and Tesseract to extract text, applies lightweight parsing heuristics to locate the amount, date, and vendor, and (if possible) predicts a category using a small keyword model that improves as you add data. The dashboard updates in real time using the returned JSON and renders charts via Chart.js.

---

### Project Goals and Scope
- Build a user‑friendly expense tracker that runs locally with minimal dependencies.
- Support both manual entry and OCR‑based extraction from receipt images.
- Provide useful analytics (by category and by month) and CSV export.
- Keep the architecture simple, readable, and easy to extend (e.g., swapping in a stronger ML model later).

---

### File Overview (What each file contains and does)

- `app.py`: Main Flask application. Configures sessions, initializes the SQLite database, defines schemas (`users`, `expenses`, `categories`), and exposes JSON endpoints for authentication (`/register`, `/login`, `/logout`), expense CRUD (`/api/expenses`), analytics (`/api/analytics`), OCR receipt processing (`/api/ocr`), category prediction (`/api/predict-category`), and CSV export (`/api/export/csv`). Contains OCR helpers (`extract_text_from_image`, `parse_receipt_text`) and a lightweight learning classifier (`SimpleExpenseClassifier`).

- `templates/login.html`: Authentication page with tabbed Login/Register forms and client‑side validation.

- `templates/dashboard.html`: Single‑page application shell for the dashboard. Includes views for Overview (charts and KPIs), Expenses (filterable table), Add Expense (manual entry), and Scan Receipt (OCR upload + confirmation form). Also includes a modal for editing expenses and a theme toggle.

- `static/js/auth.js`: Frontend logic for login and registration flows. Handles tab switching, form submission, and error display.

- `static/js/dashboard.js`: Frontend logic for the dashboard. Handles navigation, fetching categories and expenses, adding/updating/deleting expenses, calling OCR and category prediction endpoints, filtering/searching, exporting CSV, rendering charts, and theme persistence.

- `static/css/style.css`: All styling, including a light/dark theme implemented with CSS custom properties, responsive layouts, and basic animations.

- `requirements.txt`: Python dependencies (Flask, Flask‑Session, Werkzeug, Pillow, pytesseract, numpy).

- `expensevision.db`: SQLite database file created on first run (not required to exist beforehand).

---

### How It Works (Architecture and Data Flow)
1. A user registers or logs in. The server stores session data using server‑side sessions.
2. The dashboard loads categories and expenses via `/api/categories` and `/api/expenses` (with optional filters for date range, category, and search text).
3. When adding an expense manually, the client sends a JSON payload to `/api/expenses` and the server validates and inserts it into SQLite. The classifier is trained lightly on the provided description/vendor and category.
4. For OCR, a receipt image is uploaded to `/api/ocr`. The server saves the image temporarily, extracts text with Tesseract, parses amount/date/vendor heuristically, optionally predicts a category, returns the result, and deletes the uploaded file. The user can then confirm and save the expense.
5. Analytics (totals by category, monthly trends, and summary statistics) are returned from `/api/analytics` and rendered with Chart.js.
6. A CSV export of all expenses can be downloaded from `/api/export/csv`.

---

### Design Choices and Rationale
- Flask + SQLite: Simple, portable stack suitable for a CS50 project and easy local development. SQLite removes external dependencies, while Flask keeps the backend lightweight and readable.
- Server‑side sessions: Avoids exposing sensitive data in the client and works well without a separate auth provider.
- OCR via Tesseract: Mature open‑source OCR that is easy to install locally. Receipt text is noisy; pairing OCR with heuristic parsing keeps complexity manageable.
- Keyword‑based classifier: A deliberately simple baseline that “learns” by persisting observed keywords per category. It is easily replaceable with a more sophisticated model later without changing the UI or routes.
- Single‑page dashboard: Faster interaction and a cohesive user flow for adding, browsing, and analyzing expenses. Chart.js provides instant, visually clear analytics.
- Theming and accessibility: CSS custom properties enable light/dark mode with minimal code. Forms and controls are labeled and keyboard‑accessible.

Alternative approaches considered:
- Using a heavier ML/NLP model (e.g., TF‑IDF + Logistic Regression). Ultimately deferred to keep the footprint small and dependencies minimal.
- Normalizing vendor names and dates with external APIs. Deferred to maintain offline functionality and reduce complexity.

---

### Setup and Running Locally
1. Install Tesseract (required for OCR).
2. `pip install -r requirements.txt`
3. `python app.py`
4. Open `http://localhost:5000`

On first run, the app creates the database and seeds default categories. If Tesseract isn’t found on Windows, `app.py` attempts common installation paths; otherwise install from the Mannheim build and ensure the path is set.

---

### Security and Privacy Notes
- Passwords are stored with secure hashes (Werkzeug). Sessions are server‑side.
- Uploaded images are deleted after OCR. All data is local unless you export it.
- Parameterized SQL queries mitigate injection risk. Inputs are validated server‑side.

---

### Limitations and Future Work
- OCR accuracy depends on image quality; structured receipts parse best. Consider adding template‑aware parsing or confidence scoring.
- The current classifier is keyword‑based; replacing it with a supervised ML model would improve accuracy and generalization.
- Add budgets, recurring expenses, income tracking, multi‑currency support, and richer analytics (e.g., merchant drilling, anomaly detection).
- Add user profile settings, password reset flows, and optional cloud sync.

