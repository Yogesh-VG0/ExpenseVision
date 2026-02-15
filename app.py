import os
import re
import json
import base64
import threading
import time
from datetime import datetime
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, send_file
from flask_session import Session
import sqlite3

# Supabase/Postgres support: use DATABASE_URL when set (e.g. Supabase Session Pooler)
# Render may inject DATABASE_URL for internal Postgres - use EXTERNAL_DATABASE_URL for Supabase if needed
DATABASE_URL = os.environ.get('DATABASE_URL', '').strip() or os.environ.get('EXTERNAL_DATABASE_URL', '').strip()
USE_POSTGRES = bool(DATABASE_URL)

# Render: use /tmp for writable paths (ephemeral but reliable)
ON_RENDER = os.environ.get('RENDER', '').lower() == 'true'
DEBUG_ERRORS = os.environ.get('EXPENSEVISION_DEBUG', '').lower() == 'true'
if USE_POSTGRES:
    import psycopg2
    from psycopg2 import IntegrityError as PgIntegrityError
    from psycopg2.extras import RealDictCursor
    DBIntegrityError = PgIntegrityError
else:
    DBIntegrityError = sqlite3.IntegrityError
import pytesseract
from PIL import Image
import io
import csv
from collections import defaultdict
import pickle
import numpy as np
import requests

# Configure Tesseract path for Windows; optional for cloud deployment
OCR_AVAILABLE = True
if os.name == 'nt':  # Windows
    possible_paths = [
        r'C:\Program Files\Tesseract-OCR\tesseract.exe',
        r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe',
    ]
    for path in possible_paths:
        if os.path.exists(path):
            pytesseract.pytesseract.tesseract_cmd = path
            break
try:
    pytesseract.get_tesseract_version()
except Exception:
    OCR_AVAILABLE = False

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-change-in-production')
app.config['SESSION_TYPE'] = 'filesystem'
_base = '/tmp' if ON_RENDER else '.'
app.config['UPLOAD_FOLDER'] = os.environ.get('UPLOAD_FOLDER', os.path.join(_base, 'uploads'))
_session_dir = os.path.join(_base, 'flask_session') if ON_RENDER else None
app.config['SESSION_FILE_DIR'] = _session_dir
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
Session(app)

# Database setup
DATABASE = os.path.join(_base, 'expensevision.db') if (ON_RENDER and not USE_POSTGRES) else 'expensevision.db'
MODELS_DIR = os.path.join(_base, 'models') if ON_RENDER else 'models'

# Create uploads, models, and session directories
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(MODELS_DIR, exist_ok=True)
if _session_dir:
    os.makedirs(_session_dir, exist_ok=True)


def _pg_connect():
    """Connect to Postgres (Supabase). Use Session Pooler URI (port 6543) for Render."""
    url = DATABASE_URL
    # Supabase requires SSL; add sslmode if not in URL
    if 'supabase' in url.lower() and 'sslmode=' not in url:
        url = url + ('&' if '?' in url else '?') + 'sslmode=require'
    return psycopg2.connect(url, cursor_factory=RealDictCursor)


def get_db():
    """Get database connection (Postgres when DATABASE_URL set, else SQLite)."""
    if USE_POSTGRES:
        return _pg_connect()
    db = sqlite3.connect(DATABASE)
    db.row_factory = sqlite3.Row
    return db


def _sql(sql, params=None):
    """Convert ? placeholders to %s for Postgres."""
    if USE_POSTGRES and '?' in sql:
        sql = sql.replace('?', '%s')
    return sql, params or ()


def _row_to_dict(row):
    """Convert DB row to JSON-serializable dict (handles date/datetime)."""
    d = dict(row)
    for k, v in d.items():
        if hasattr(v, 'strftime'):
            d[k] = v.strftime('%Y-%m-%d')
    return d


def init_db():
    """Initialize database with tables (Postgres or SQLite)."""
    db = get_db()
    cursor = db.cursor()

    if USE_POSTGRES:
        # Postgres DDL
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS expenses (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                amount REAL NOT NULL,
                category TEXT NOT NULL,
                description TEXT,
                vendor TEXT,
                date DATE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS categories (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                icon TEXT
            )
        ''')
        default_categories = [
            ('Food & Dining', '≡ƒìö'),
            ('Transportation', '≡ƒÜù'),
            ('Shopping', '≡ƒ¢ì∩╕Å'),
            ('Entertainment', '≡ƒÄ¼'),
            ('Bills & Utilities', '≡ƒÆí'),
            ('Healthcare', 'ΓÜò∩╕Å'),
            ('Education', '≡ƒôÜ'),
            ('Travel', 'Γ£ê∩╕Å'),
            ('Groceries', '≡ƒ¢Æ'),
            ('Other', '≡ƒôª')
        ]
        for cat_name, icon in default_categories:
            cursor.execute(
                "INSERT INTO categories (name, icon) VALUES (%s, %s) ON CONFLICT (name) DO NOTHING",
                (cat_name, icon)
            )
    else:
        # SQLite DDL
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                amount REAL NOT NULL,
                category TEXT NOT NULL,
                description TEXT,
                vendor TEXT,
                date TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                icon TEXT
            )
        ''')
        default_categories = [
            ('Food & Dining', '≡ƒìö'),
            ('Transportation', '≡ƒÜù'),
            ('Shopping', '≡ƒ¢ì∩╕Å'),
            ('Entertainment', '≡ƒÄ¼'),
            ('Bills & Utilities', '≡ƒÆí'),
            ('Healthcare', 'ΓÜò∩╕Å'),
            ('Education', '≡ƒôÜ'),
            ('Travel', 'Γ£ê∩╕Å'),
            ('Groceries', '≡ƒ¢Æ'),
            ('Other', '≡ƒôª')
        ]
        for cat_name, icon in default_categories:
            cursor.execute('INSERT OR IGNORE INTO categories (name, icon) VALUES (?, ?)',
                           (cat_name, icon))

    db.commit()
    db.close()

# Login required decorator


def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

# OCR Helper Functions


def extract_text_from_image(image_path):
    """Extract text from image using Tesseract OCR"""
    try:
        image = Image.open(image_path)
        text = pytesseract.image_to_string(image)
        return text
    except Exception as e:
        print(f"OCR Error: {e}")
        return ""


def parse_receipt_text(text):
    """Parse receipt text to extract relevant information"""
    result = {
        'amount': None,
        'vendor': None,
        'date': None,
        'items': [],
        'description': None
    }

    lines = text.split('\n')

    # Extract amount (look for patterns like $XX.XX, XX.XX, TOTAL, etc.)
    amount_patterns = [
        r'total[:\s]+\$?(\d+\.?\d*)',
        r'amount[:\s]+\$?(\d+\.?\d*)',
        r'\$(\d+\.\d{2})',
        r'(\d+\.\d{2})'
    ]

    for line in lines:
        line_lower = line.lower()
        for pattern in amount_patterns:
            match = re.search(pattern, line_lower)
            if match and result['amount'] is None:
                try:
                    amount = float(match.group(1))
                    if amount > 0 and amount < 10000:  # Reasonable amount range
                        result['amount'] = amount
                        break
                except ValueError:
                    continue

    # Extract date
    date_patterns = [
        r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
        r'(\d{4}[/-]\d{1,2}[/-]\d{1,2})'
    ]

    for line in lines:
        for pattern in date_patterns:
            match = re.search(pattern, line)
            if match:
                result['date'] = match.group(1)
                break
        if result['date']:
            break

    # Extract vendor (usually first few non-empty lines)
    for line in lines[:5]:
        line = line.strip()
        if line and len(line) > 2 and not re.search(r'\d{3,}', line):
            result['vendor'] = line
            break

    # Description: first few meaningful lines (skip mostly digits)
    desc_lines = []
    for line in lines[:12]:
        line = line.strip()
        if line and len(line) > 1 and not re.match(r'^[\d\s\.\,\$]+$', line):
            desc_lines.append(line)
            if len(desc_lines) >= 5:
                break
    if desc_lines:
        result['description'] = ' '.join(desc_lines)[:500]  # cap length

    return result


# Veryfi API (optional): receipt OCR in production without Tesseract
VERYFI_CLIENT_ID = os.environ.get('VERYFI_CLIENT_ID', '').strip()
VERYFI_USERNAME = os.environ.get('VERYFI_USERNAME', '').strip()
VERYFI_API_KEY = os.environ.get('VERYFI_API_KEY', '').strip()
VERYFI_AVAILABLE = bool(VERYFI_CLIENT_ID and VERYFI_USERNAME and VERYFI_API_KEY)

VERYFI_API_URL = 'https://api.veryfi.com/api/v8/partner/documents'


def _get_nested_value(obj, *keys):
    """Get value from nested dict; handle objects like { 'value': 123 }."""
    for key in keys:
        if obj is None:
            return None
        obj = obj.get(key) if isinstance(obj, dict) else getattr(obj, key, None)
    if isinstance(obj, dict) and 'value' in obj:
        return obj.get('value')
    return obj


def parse_receipt_veryfi(filepath, filename):
    """
    Send image to Veryfi API and return parsed data in our app's format.
    Returns dict: amount, vendor, date, items, raw_text, predicted_category (if any).
    """
    with open(filepath, 'rb') as f:
        file_b64 = base64.b64encode(f.read()).decode('utf-8')

    headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'CLIENT-ID': VERYFI_CLIENT_ID,
        'AUTHORIZATION': f'apikey {VERYFI_USERNAME}:{VERYFI_API_KEY}',
    }
    payload = {
        'file_data': file_b64,
        'file_name': filename or 'receipt.jpg',
        'document_type': 'receipt',
    }

    resp = requests.post(VERYFI_API_URL, headers=headers, json=payload, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    meta = data.get('meta') or {}
    # Veryfi returns total/date/vendor as objects with .value or direct values
    total_val = _get_nested_value(meta, 'total') or _get_nested_value(data, 'total')
    if total_val is not None:
        try:
            total_val = float(total_val)
        except (TypeError, ValueError):
            total_val = None

    date_val = _get_nested_value(meta, 'date') or data.get('date')
    if date_val and isinstance(date_val, str) and 'T' in date_val:
        date_val = date_val.split('T')[0]  # YYYY-MM-DD for our frontend

    vendor_obj = meta.get('vendor') or data.get('vendor')
    if isinstance(vendor_obj, dict):
        vendor_val = vendor_obj.get('name') or vendor_obj.get('raw_name')
    else:
        vendor_val = vendor_obj

    default_category = _get_nested_value(meta, 'default_category') or meta.get('default_category') or data.get('category')
    # Map Veryfi categories to our app categories when possible
    veryfi_to_app_category = {
        'food and groceries': 'Groceries',
        'meals & entertainment': 'Food & Dining',
        'food and grocers': 'Groceries',
        'travel': 'Travel',
        'transportation': 'Transportation',
        'automotive': 'Transportation',
        'office supplies & software': 'Shopping',
        'utilities': 'Bills & Utilities',
        'healthcare': 'Healthcare',
        'training & education': 'Education',
    }
    if default_category and isinstance(default_category, str):
        key = default_category.lower().strip()
        default_category = veryfi_to_app_category.get(key, default_category)

    line_items = data.get('line_items') or []
    items = []
    item_descriptions = []
    for li in line_items:
        if isinstance(li, dict):
            desc = (li.get('description') or li.get('text') or '').strip()
            total = li.get('total') or li.get('price')
            if total is not None:
                try:
                    total = float(total)
                except (TypeError, ValueError):
                    total = None
            items.append({'description': desc, 'total': total})
            if desc:
                item_descriptions.append(desc)
        else:
            items.append({'description': str(li), 'total': None})

    # Build description from line items for the expense form
    description_val = None
    if item_descriptions:
        description_val = ', '.join(item_descriptions[:15])  # first 15 items
        if len(item_descriptions) > 15:
            description_val += f' (+{len(item_descriptions) - 15} more)'

    return {
        'amount': total_val,
        'vendor': vendor_val or None,
        'date': date_val,
        'description': description_val,
        'items': items,
        'raw_text': data.get('ocr_text') or '',
        'predicted_category': default_category,
    }


# ML Helper Functions


class SimpleExpenseClassifier:
    """Simple ML classifier for expense categorization"""

    def __init__(self):
        self.categories = []
        self.keywords = defaultdict(list)
        self.load_model()

    def load_model(self):
        """Load or initialize the model"""
        model_path = os.path.join(MODELS_DIR, 'expense_classifier.pkl')
        if os.path.exists(model_path):
            try:
                with open(model_path, 'rb') as f:
                    data = pickle.load(f)
                    self.keywords = data.get('keywords', defaultdict(list))
                    self.categories = data.get('categories', [])
            except Exception:
                self.initialize_default_keywords()
        else:
            self.initialize_default_keywords()

    def initialize_default_keywords(self):
        """Initialize with default keywords for categories"""
        self.keywords = {
            'Food & Dining': ['restaurant', 'cafe', 'food', 'pizza', 'burger', 'coffee', 'lunch', 'dinner', 'breakfast', 'mcdonald', 'starbucks', 'subway'],
            'Transportation': ['uber', 'lyft', 'taxi', 'gas', 'fuel', 'parking', 'metro', 'bus', 'train', 'transit'],
            'Shopping': ['amazon', 'mall', 'store', 'shop', 'retail', 'clothing', 'fashion', 'electronics'],
            'Entertainment': ['movie', 'cinema', 'netflix', 'spotify', 'game', 'concert', 'theater', 'ticket'],
            'Bills & Utilities': ['electric', 'water', 'internet', 'phone', 'utility', 'bill', 'subscription'],
            'Healthcare': ['doctor', 'hospital', 'pharmacy', 'medical', 'health', 'clinic', 'medicine'],
            'Education': ['school', 'university', 'course', 'book', 'tuition', 'education', 'learning'],
            'Travel': ['hotel', 'flight', 'airline', 'booking', 'airbnb', 'vacation', 'travel'],
            'Groceries': ['grocery', 'supermarket', 'walmart', 'target', 'market', 'produce', 'vegetables']
        }
        self.save_model()

    def save_model(self):
        """Save the model to disk"""
        model_path = os.path.join(MODELS_DIR, 'expense_classifier.pkl')
        try:
            with open(model_path, 'wb') as f:
                pickle.dump({
                    'keywords': dict(self.keywords),
                    'categories': self.categories
                }, f)
        except Exception as e:
            print(f"Error saving model: {e}")

    def predict_category(self, description, vendor=''):
        """Predict category based on description and vendor"""
        text = (description + ' ' + vendor).lower()
        scores = defaultdict(int)

        for category, keywords in self.keywords.items():
            for keyword in keywords:
                if keyword.lower() in text:
                    scores[category] += 1

        if scores:
            return max(scores.items(), key=lambda x: x[1])[0]
        return 'Other'

    def train(self, description, vendor, category):
        """Train the model with new data"""
        words = (description + ' ' + vendor).lower().split()
        for word in words:
            if len(word) > 3 and word not in self.keywords[category]:
                self.keywords[category].append(word)
        self.save_model()


# Initialize classifier
classifier = SimpleExpenseClassifier()

# Routes


@app.route('/')
def index():
    """Main page"""
    if 'user_id' in session:
        return render_template('dashboard.html')
    return render_template('login.html')


@app.errorhandler(500)
def handle_500(err):
    """Return JSON for API/auth routes so frontend gets parseable response."""
    if request.path.startswith(('/api', '/register', '/login', '/logout')):
        err_msg = 'Server error. Please try again.'
        if DEBUG_ERRORS:
            err_msg = str(err)
        return jsonify({'error': err_msg}), 500
    from flask import render_template_string
    return render_template_string('<h1>Internal Server Error</h1>'), 500


@app.route('/favicon.ico')
def favicon():
    """Avoid 404 when browser requests favicon."""
    return '', 204


@app.route('/healthz')
def healthz():
    """Health check for Render. Verifies DB connectivity."""
    try:
        db = get_db()
        db.cursor().execute('SELECT 1')
        db.close()
        return '', 200
    except Exception:
        return '', 503


@app.route('/register', methods=['POST'])
def register():
    """Register new user"""
    data = request.get_json(silent=True) or {}
    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    try:
        db = get_db()
        cursor = db.cursor()
        try:
            password_hash = generate_password_hash(password)
            sql, _ = _sql('INSERT INTO users (username, password_hash) VALUES (?, ?)')
            if USE_POSTGRES:
                cursor.execute(sql + ' RETURNING id', (username, password_hash))
                user_id = cursor.fetchone()['id']
            else:
                cursor.execute(sql, (username, password_hash))
                user_id = cursor.lastrowid
            db.commit()
            session['user_id'] = user_id
            session['username'] = username
            return jsonify({'success': True, 'username': username})
        except DBIntegrityError:
            return jsonify({'error': 'Username already exists'}), 400
        finally:
            db.close()
    except Exception as e:
        app.logger.exception('Registration failed')
        err_msg = 'Registration failed. Please try again or contact support.'
        if DEBUG_ERRORS:
            err_msg = str(e)
        return jsonify({'error': err_msg}), 500


@app.route('/login', methods=['POST'])
def login():
    """Login user"""
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    db = get_db()
    cursor = db.cursor()
    sql, p = _sql('SELECT * FROM users WHERE username = ?', (username,))
    cursor.execute(sql, p)
    user = cursor.fetchone()
    db.close()

    if user and check_password_hash(user['password_hash'], password):
        session['user_id'] = user['id']
        session['username'] = user['username']
        return jsonify({'success': True, 'username': username})

    return jsonify({'error': 'Invalid username or password'}), 401


@app.route('/logout', methods=['POST'])
def logout():
    """Logout user"""
    session.clear()
    return jsonify({'success': True})


@app.route('/api/expenses', methods=['GET'])
@login_required
def get_expenses():
    """Get all expenses for current user"""
    user_id = session['user_id']

    # Get query parameters for filtering
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    category = request.args.get('category')
    search = request.args.get('search', '')

    db = get_db()
    cursor = db.cursor()

    query = 'SELECT * FROM expenses WHERE user_id = ?'
    params = [user_id]

    if start_date:
        query += ' AND date >= ?'
        params.append(start_date)

    if end_date:
        query += ' AND date <= ?'
        params.append(end_date)

    if category:
        query += ' AND category = ?'
        params.append(category)

    if search:
        query += ' AND (description LIKE ? OR vendor LIKE ?)'
        search_param = f'%{search}%'
        params.extend([search_param, search_param])

    query += ' ORDER BY date DESC'

    exec_sql, p = _sql(query, params)
    cursor.execute(exec_sql, p)
    expenses = [_row_to_dict(row) for row in cursor.fetchall()]
    db.close()

    return jsonify(expenses)


@app.route('/api/expenses', methods=['POST'])
@login_required
def add_expense():
    """Add new expense"""
    data = request.get_json()
    user_id = session['user_id']

    amount = data.get('amount')
    category = data.get('category')
    description = data.get('description', '')
    vendor = data.get('vendor', '')
    date = data.get('date')

    if not amount or not category or not date:
        return jsonify({'error': 'Amount, category, and date are required'}), 400

    try:
        amount = float(amount)
        if amount <= 0:
            return jsonify({'error': 'Amount must be positive'}), 400
    except ValueError:
        return jsonify({'error': 'Invalid amount'}), 400

    db = get_db()
    cursor = db.cursor()
    sql = '''
        INSERT INTO expenses (user_id, amount, category, description, vendor, date)
        VALUES (?, ?, ?, ?, ?, ?)
    '''
    params = (user_id, amount, category, description, vendor, date)
    exec_sql, p = _sql(sql, params)
    if USE_POSTGRES:
        cursor.execute(exec_sql + ' RETURNING id', p)
        expense_id = cursor.fetchone()['id']
    else:
        cursor.execute(exec_sql, p)
        expense_id = cursor.lastrowid
    db.commit()
    db.close()

    # Train classifier with new data
    classifier.train(description, vendor, category)

    return jsonify({'success': True, 'id': expense_id})


@app.route('/api/expenses/<int:expense_id>', methods=['PUT'])
@login_required
def update_expense(expense_id):
    """Update existing expense"""
    data = request.get_json()
    user_id = session['user_id']

    db = get_db()
    cursor = db.cursor()

    # Verify ownership
    exec_sql, p = _sql('SELECT * FROM expenses WHERE id = ? AND user_id = ?', (expense_id, user_id))
    cursor.execute(exec_sql, p)
    expense = cursor.fetchone()

    if not expense:
        db.close()
        return jsonify({'error': 'Expense not found'}), 404

    amount = data.get('amount', expense['amount'])
    category = data.get('category', expense['category'])
    description = data.get('description', expense['description'])
    vendor = data.get('vendor', expense['vendor'])
    date = data.get('date', expense['date'])

    exec_sql, p = _sql('''
        UPDATE expenses
        SET amount = ?, category = ?, description = ?, vendor = ?, date = ?
        WHERE id = ? AND user_id = ?
    ''', (amount, category, description, vendor, date, expense_id, user_id))
    cursor.execute(exec_sql, p)
    db.commit()
    db.close()

    return jsonify({'success': True})


@app.route('/api/expenses/<int:expense_id>', methods=['DELETE'])
@login_required
def delete_expense(expense_id):
    """Delete expense"""
    user_id = session['user_id']

    db = get_db()
    cursor = db.cursor()
    exec_sql, p = _sql('DELETE FROM expenses WHERE id = ? AND user_id = ?', (expense_id, user_id))
    cursor.execute(exec_sql, p)
    db.commit()

    if cursor.rowcount == 0:
        db.close()
        return jsonify({'error': 'Expense not found'}), 404

    db.close()
    return jsonify({'success': True})


@app.route('/api/categories', methods=['GET'])
@login_required
def get_categories():
    """Get all categories"""
    db = get_db()
    cursor = db.cursor()
    exec_sql, p = _sql('SELECT * FROM categories ORDER BY name')
    cursor.execute(exec_sql, p)
    categories = [dict(row) for row in cursor.fetchall()]
    db.close()
    return jsonify(categories)


@app.route('/api/analytics', methods=['GET'])
@login_required
def get_analytics():
    """Get expense analytics"""
    user_id = session['user_id']

    db = get_db()
    cursor = db.cursor()

    # Total by category
    sql1, p = _sql('''
        SELECT category, SUM(amount) as total, COUNT(*) as count
        FROM expenses
        WHERE user_id = ?
        GROUP BY category
        ORDER BY total DESC
    ''', (user_id,))
    cursor.execute(sql1, p)
    by_category = [dict(row) for row in cursor.fetchall()]

    # Total by month (Postgres: to_char; SQLite: strftime)
    if USE_POSTGRES:
        sql2 = '''
            SELECT to_char(date, 'YYYY-MM') as month, SUM(amount) as total
            FROM expenses
            WHERE user_id = %s
            GROUP BY to_char(date, 'YYYY-MM')
            ORDER BY month DESC
            LIMIT 12
        '''
        cursor.execute(sql2, (user_id,))
    else:
        sql2, p = _sql('''
            SELECT strftime('%Y-%m', date) as month, SUM(amount) as total
            FROM expenses
            WHERE user_id = ?
            GROUP BY month
            ORDER BY month DESC
            LIMIT 12
        ''', (user_id,))
        cursor.execute(sql2, p)
    by_month = [dict(row) for row in cursor.fetchall()]

    # Total by day (last 30 days)
    sql3, p = _sql('''
        SELECT date as day, SUM(amount) as total
        FROM expenses
        WHERE user_id = ?
        GROUP BY day
        ORDER BY day DESC
        LIMIT 30
    ''', (user_id,))
    cursor.execute(sql3, p)
    by_day = [dict(row) for row in cursor.fetchall()]
    # Ensure day is string (Postgres DATE returns date object)
    for row in by_day:
        if 'day' in row and hasattr(row['day'], 'strftime'):
            row['day'] = row['day'].strftime('%Y-%m-%d')

    # Overall stats
    sql4, p = _sql('''
        SELECT
            SUM(amount) as total,
            COUNT(*) as count,
            AVG(amount) as average
        FROM expenses
        WHERE user_id = ?
    ''', (user_id,))
    cursor.execute(sql4, p)
    row = cursor.fetchone()
    stats = {
        'total': float(row['total'] or 0) if row else 0,
        'count': int(row['count'] or 0) if row else 0,
        'average': float(row['average'] or 0) if row else 0
    }

    db.close()

    return jsonify({
        'by_category': by_category,
        'by_month': by_month,
        'by_day': by_day,
        'stats': stats
    })


@app.route('/api/ocr', methods=['POST'])
@login_required
def ocr_receipt():
    """Process receipt image with OCR (Veryfi API or Tesseract)."""
    if not VERYFI_AVAILABLE and not OCR_AVAILABLE:
        return jsonify({
            'error': 'Receipt scanning is not available. Set VERYFI_* env vars or install Tesseract.'
        }), 503

    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)

    try:
        if VERYFI_AVAILABLE:
            parsed = parse_receipt_veryfi(filepath, filename)
            raw_text = parsed.pop('raw_text', '')
            predicted = parsed.get('predicted_category')
            if not predicted and parsed.get('vendor'):
                predicted = classifier.predict_category(parsed.get('vendor', ''), parsed.get('vendor', ''))
            parsed['predicted_category'] = predicted
            parsed.setdefault('items', [])
        else:
            text = extract_text_from_image(filepath)
            parsed = parse_receipt_text(text)
            if parsed.get('vendor'):
                parsed['predicted_category'] = classifier.predict_category(parsed['vendor'], parsed['vendor'])
            raw_text = text

        os.remove(filepath)
        return jsonify({'success': True, 'raw_text': raw_text, 'parsed': parsed})
    except requests.RequestException as e:
        if os.path.exists(filepath):
            os.remove(filepath)
        err = e.response.text if getattr(e, 'response', None) else str(e)
        return jsonify({'error': f'Receipt API error: {err}'}), 502
    except Exception as e:
        if os.path.exists(filepath):
            os.remove(filepath)
        return jsonify({'error': f'OCR processing failed: {str(e)}'}), 500


@app.route('/api/predict-category', methods=['POST'])
@login_required
def predict_category():
    """Predict category for expense description"""
    data = request.get_json()
    description = data.get('description', '')
    vendor = data.get('vendor', '')

    predicted = classifier.predict_category(description, vendor)

    return jsonify({'category': predicted})


@app.route('/api/export/csv', methods=['GET'])
@login_required
def export_csv():
    """Export expenses to CSV"""
    user_id = session['user_id']

    db = get_db()
    cursor = db.cursor()
    sql, p = _sql('''
        SELECT date, category, description, vendor, amount
        FROM expenses
        WHERE user_id = ?
        ORDER BY date DESC
    ''', (user_id,))
    cursor.execute(sql, p)
    expenses = cursor.fetchall()
    db.close()

    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Date', 'Category', 'Description', 'Vendor', 'Amount'])

    for expense in expenses:
        date_val = expense['date']
        if hasattr(date_val, 'strftime'):
            date_val = date_val.strftime('%Y-%m-%d')
        writer.writerow([
            date_val or '',
            expense['category'],
            expense['description'],
            expense['vendor'],
            f"{expense['amount']:.2f}"
        ])

    # Create response
    output.seek(0)
    return send_file(
        io.BytesIO(output.getvalue().encode('utf-8')),
        mimetype='text/csv',
        as_attachment=True,
        download_name=f'expenses_{datetime.now().strftime("%Y%m%d")}.csv'
    )


# Ensure tables exist when app is loaded (gunicorn does not run if __name__ block)
init_db()


# ---------------------------------------------------------------------------
# Self-ping keep-alive: prevents Render free-tier from spinning down after
# 15 minutes of inactivity.  A lightweight daemon thread pings /healthz
# every 10 minutes.  Render automatically sets RENDER_EXTERNAL_URL.
# ---------------------------------------------------------------------------
def _keep_alive():
    """Background thread that pings the service to prevent idle spin-down."""
    service_url = os.environ.get('RENDER_EXTERNAL_URL', '').rstrip('/')
    if not service_url:
        print('[keep-alive] RENDER_EXTERNAL_URL not set — self-ping disabled.')
        return
    ping_url = f'{service_url}/healthz'
    interval = int(os.environ.get('KEEP_ALIVE_INTERVAL', 600))  # default 10 min
    print(f'[keep-alive] Pinging {ping_url} every {interval}s')
    while True:
        time.sleep(interval)
        try:
            resp = requests.get(ping_url, timeout=10)
            print(f'[keep-alive] Ping {ping_url} -> {resp.status_code}')
        except Exception as exc:
            print(f'[keep-alive] Ping failed: {exc}')


if ON_RENDER:
    _keep_alive_thread = threading.Thread(target=_keep_alive, daemon=True)
    _keep_alive_thread.start()


if __name__ == '__main__':
    debug = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=debug, host='0.0.0.0', port=port)
