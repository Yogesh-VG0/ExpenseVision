import os
import re
import json
import base64
from datetime import datetime
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, send_file
from flask_session import Session
import sqlite3
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
app.config['UPLOAD_FOLDER'] = os.environ.get('UPLOAD_FOLDER', 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
Session(app)

# Create uploads directory if it doesn't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs('models', exist_ok=True)

# Database setup
DATABASE = 'expensevision.db'


def get_db():
    """Get database connection"""
    db = sqlite3.connect(DATABASE)
    db.row_factory = sqlite3.Row
    return db


def init_db():
    """Initialize database with tables"""
    db = get_db()
    cursor = db.cursor()

    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Expenses table
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

    # Categories table (predefined categories)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            icon TEXT
        )
    ''')

    # Insert default categories if not exist
    default_categories = [
        ('Food & Dining', '🍔'),
        ('Transportation', '🚗'),
        ('Shopping', '🛍️'),
        ('Entertainment', '🎬'),
        ('Bills & Utilities', '💡'),
        ('Healthcare', '⚕️'),
        ('Education', '📚'),
        ('Travel', '✈️'),
        ('Groceries', '🛒'),
        ('Other', '📦')
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
        'items': []
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
    for li in line_items:
        if isinstance(li, dict):
            desc = li.get('description') or li.get('text') or ''
            total = li.get('total') or li.get('price')
            if total is not None:
                try:
                    total = float(total)
                except (TypeError, ValueError):
                    total = None
            items.append({'description': desc, 'total': total})
        else:
            items.append({'description': str(li), 'total': None})

    return {
        'amount': total_val,
        'vendor': vendor_val or None,
        'date': date_val,
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
        model_path = 'models/expense_classifier.pkl'
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
        model_path = 'models/expense_classifier.pkl'
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


@app.route('/favicon.ico')
def favicon():
    """Avoid 404 when browser requests favicon."""
    return '', 204


@app.route('/register', methods=['POST'])
def register():
    """Register new user"""
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    db = get_db()
    cursor = db.cursor()

    try:
        password_hash = generate_password_hash(password)
        cursor.execute('INSERT INTO users (username, password_hash) VALUES (?, ?)',
                       (username, password_hash))
        db.commit()
        user_id = cursor.lastrowid
        session['user_id'] = user_id
        session['username'] = username
        return jsonify({'success': True, 'username': username})
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Username already exists'}), 400
    finally:
        db.close()


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
    cursor.execute('SELECT * FROM users WHERE username = ?', (username,))
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

    cursor.execute(query, params)
    expenses = [dict(row) for row in cursor.fetchall()]
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
    cursor.execute('''
        INSERT INTO expenses (user_id, amount, category, description, vendor, date)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (user_id, amount, category, description, vendor, date))
    db.commit()
    expense_id = cursor.lastrowid
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
    cursor.execute('SELECT * FROM expenses WHERE id = ? AND user_id = ?', (expense_id, user_id))
    expense = cursor.fetchone()

    if not expense:
        db.close()
        return jsonify({'error': 'Expense not found'}), 404

    amount = data.get('amount', expense['amount'])
    category = data.get('category', expense['category'])
    description = data.get('description', expense['description'])
    vendor = data.get('vendor', expense['vendor'])
    date = data.get('date', expense['date'])

    cursor.execute('''
        UPDATE expenses
        SET amount = ?, category = ?, description = ?, vendor = ?, date = ?
        WHERE id = ? AND user_id = ?
    ''', (amount, category, description, vendor, date, expense_id, user_id))
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
    cursor.execute('DELETE FROM expenses WHERE id = ? AND user_id = ?', (expense_id, user_id))
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
    cursor.execute('SELECT * FROM categories ORDER BY name')
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
    cursor.execute('''
        SELECT category, SUM(amount) as total, COUNT(*) as count
        FROM expenses
        WHERE user_id = ?
        GROUP BY category
        ORDER BY total DESC
    ''', (user_id,))
    by_category = [dict(row) for row in cursor.fetchall()]

    # Total by month
    cursor.execute('''
        SELECT strftime('%Y-%m', date) as month, SUM(amount) as total
        FROM expenses
        WHERE user_id = ?
        GROUP BY month
        ORDER BY month DESC
        LIMIT 12
    ''', (user_id,))
    by_month = [dict(row) for row in cursor.fetchall()]

    # Overall stats
    cursor.execute('''
        SELECT
            SUM(amount) as total,
            COUNT(*) as count,
            AVG(amount) as average
        FROM expenses
        WHERE user_id = ?
    ''', (user_id,))
    stats = dict(cursor.fetchone())

    db.close()

    return jsonify({
        'by_category': by_category,
        'by_month': by_month,
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
    cursor.execute('''
        SELECT date, category, description, vendor, amount
        FROM expenses
        WHERE user_id = ?
        ORDER BY date DESC
    ''', (user_id,))
    expenses = cursor.fetchall()
    db.close()

    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Date', 'Category', 'Description', 'Vendor', 'Amount'])

    for expense in expenses:
        writer.writerow([
            expense['date'],
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


if __name__ == '__main__':
    init_db()
    debug = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=debug, host='0.0.0.0', port=port)
