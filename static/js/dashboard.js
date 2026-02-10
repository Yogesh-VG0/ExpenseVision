// Dashboard JavaScript

let expenses = [];
let categories = [];
let categoryChart = null;
let monthChart = null;

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    // Theme initialization
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    // Event listeners
    setupEventListeners();

    // Load data
    await loadCategories();
    await loadExpenses();
    await loadAnalytics();

    // Set default date to today
    document.getElementById('expense-date').valueAsDate = new Date();
    document.getElementById('ocr-date').valueAsDate = new Date();
}

function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = item.dataset.view;
            switchView(view);
        });
    });

    // Theme toggle
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    // Logout
    document.getElementById('logout-btn').addEventListener('click', logout);

    // Add expense form
    document.getElementById('expense-form').addEventListener('submit', addExpense);
    document.getElementById('predict-category-btn').addEventListener('click', predictCategory);

    // OCR receipt
    document.getElementById('select-file-btn').addEventListener('click', () => {
        document.getElementById('receipt-file').click();
    });
    document.getElementById('receipt-file').addEventListener('change', handleFileSelect);
    document.getElementById('scan-another-btn').addEventListener('click', resetOCR);
    document.getElementById('ocr-form').addEventListener('submit', saveOCRExpense);

    // Drag and drop for OCR
    const uploadArea = document.getElementById('upload-area');
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            processReceipt(file);
        }
    });

    // Export CSV
    document.getElementById('export-csv-btn').addEventListener('click', exportCSV);

    // Filters
    document.getElementById('search-input').addEventListener('input', filterExpenses);
    document.getElementById('category-filter').addEventListener('change', filterExpenses);
    document.getElementById('start-date-filter').addEventListener('change', filterExpenses);
    document.getElementById('end-date-filter').addEventListener('change', filterExpenses);
    document.getElementById('clear-filters-btn').addEventListener('click', clearFilters);

    // Edit modal
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', closeEditModal);
    });
    document.getElementById('edit-expense-form').addEventListener('submit', updateExpense);

    // Close modal on outside click
    document.getElementById('edit-modal').addEventListener('click', (e) => {
        if (e.target.id === 'edit-modal') {
            closeEditModal();
        }
    });
}

function switchView(viewName) {
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.view === viewName) {
            item.classList.add('active');
        }
    });

    // Update views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    document.getElementById(`${viewName}-view`).classList.add('active');
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = document.querySelector('.theme-icon');
    icon.textContent = theme === 'light' ? '🌙' : '☀️';
}

async function logout() {
    try {
        await fetch('/logout', { method: 'POST' });
        window.location.href = '/';
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Categories
async function loadCategories() {
    try {
        const response = await fetch('/api/categories');
        categories = await response.json();

        // Populate category selects
        const selects = [
            document.getElementById('expense-category'),
            document.getElementById('ocr-category'),
            document.getElementById('edit-category'),
            document.getElementById('category-filter')
        ];

        selects.forEach(select => {
            if (select.id === 'category-filter') {
                // Keep "All Categories" option for filter
                select.innerHTML = '<option value="">All Categories</option>';
            } else {
                select.innerHTML = '<option value="">Select a category</option>';
            }

            categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.name;
                option.textContent = `${cat.icon} ${cat.name}`;
                select.appendChild(option);
            });
        });
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

// Expenses
async function loadExpenses() {
    try {
        const params = new URLSearchParams();
        const search = document.getElementById('search-input').value;
        const category = document.getElementById('category-filter').value;
        const startDate = document.getElementById('start-date-filter').value;
        const endDate = document.getElementById('end-date-filter').value;

        if (search) params.append('search', search);
        if (category) params.append('category', category);
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);

        const response = await fetch(`/api/expenses?${params}`);
        expenses = await response.json();

        displayExpenses();
    } catch (error) {
        console.error('Error loading expenses:', error);
    }
}

function displayExpenses() {
    const tbody = document.getElementById('expenses-tbody');

    if (expenses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No expenses found. Add your first expense!</td></tr>';
        return;
    }

    tbody.innerHTML = expenses.map(expense => `
        <tr>
            <td>${formatDate(expense.date)}</td>
            <td><span class="category-badge">${getCategoryIcon(expense.category)} ${expense.category}</span></td>
            <td>${expense.description || '-'}</td>
            <td>${expense.vendor || '-'}</td>
            <td class="amount">$${parseFloat(expense.amount).toFixed(2)}</td>
            <td class="actions">
                <button class="btn btn-sm btn-secondary" onclick="openEditModal(${expense.id})">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteExpense(${expense.id})">Delete</button>
            </td>
        </tr>
    `).join('');
}

function getCategoryIcon(categoryName) {
    const category = categories.find(c => c.name === categoryName);
    return category ? category.icon : '📦';
}

async function addExpense(e) {
    e.preventDefault();

    const amount = document.getElementById('expense-amount').value;
    const category = document.getElementById('expense-category').value;
    const description = document.getElementById('expense-description').value;
    const vendor = document.getElementById('expense-vendor').value;
    const date = document.getElementById('expense-date').value;

    try {
        const response = await fetch('/api/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, category, description, vendor, date })
        });

        const data = await response.json();

        if (response.ok) {
            document.getElementById('expense-success').textContent = 'Expense added successfully!';
            document.getElementById('expense-form').reset();
            document.getElementById('expense-date').valueAsDate = new Date();

            setTimeout(() => {
                document.getElementById('expense-success').textContent = '';
            }, 3000);

            await loadExpenses();
            await loadAnalytics();
        } else {
            document.getElementById('expense-error').textContent = data.error || 'Failed to add expense';
        }
    } catch (error) {
        document.getElementById('expense-error').textContent = 'An error occurred';
        console.error('Error adding expense:', error);
    }
}

async function predictCategory() {
    const description = document.getElementById('expense-description').value;
    const vendor = document.getElementById('expense-vendor').value;

    if (!description && !vendor) {
        alert('Please enter a description or vendor first');
        return;
    }

    try {
        const response = await fetch('/api/predict-category', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description, vendor })
        });

        const data = await response.json();
        document.getElementById('expense-category').value = data.category;
    } catch (error) {
        console.error('Error predicting category:', error);
    }
}

function openEditModal(expenseId) {
    const expense = expenses.find(e => e.id === expenseId);
    if (!expense) return;

    document.getElementById('edit-expense-id').value = expense.id;
    document.getElementById('edit-amount').value = expense.amount;
    document.getElementById('edit-category').value = expense.category;
    document.getElementById('edit-description').value = expense.description || '';
    document.getElementById('edit-vendor').value = expense.vendor || '';
    document.getElementById('edit-date').value = expense.date;

    document.getElementById('edit-modal').classList.add('active');
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.remove('active');
    document.getElementById('edit-error').textContent = '';
}

async function updateExpense(e) {
    e.preventDefault();

    const id = document.getElementById('edit-expense-id').value;
    const amount = document.getElementById('edit-amount').value;
    const category = document.getElementById('edit-category').value;
    const description = document.getElementById('edit-description').value;
    const vendor = document.getElementById('edit-vendor').value;
    const date = document.getElementById('edit-date').value;

    try {
        const response = await fetch(`/api/expenses/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, category, description, vendor, date })
        });

        if (response.ok) {
            closeEditModal();
            await loadExpenses();
            await loadAnalytics();
        } else {
            const data = await response.json();
            document.getElementById('edit-error').textContent = data.error || 'Failed to update expense';
        }
    } catch (error) {
        document.getElementById('edit-error').textContent = 'An error occurred';
        console.error('Error updating expense:', error);
    }
}

async function deleteExpense(expenseId) {
    if (!confirm('Are you sure you want to delete this expense?')) {
        return;
    }

    try {
        const response = await fetch(`/api/expenses/${expenseId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            await loadExpenses();
            await loadAnalytics();
        } else {
            alert('Failed to delete expense');
        }
    } catch (error) {
        console.error('Error deleting expense:', error);
        alert('An error occurred');
    }
}

function filterExpenses() {
    loadExpenses();
}

function clearFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('category-filter').value = '';
    document.getElementById('start-date-filter').value = '';
    document.getElementById('end-date-filter').value = '';
    loadExpenses();
}

// OCR
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        processReceipt(file);
    }
}

async function processReceipt(file) {
    document.getElementById('upload-area').style.display = 'none';
    document.getElementById('ocr-loading').style.display = 'block';
    document.getElementById('ocr-result').style.display = 'none';

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/api/ocr', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            document.getElementById('ocr-loading').style.display = 'none';
            document.getElementById('ocr-result').style.display = 'block';

            // Populate form with parsed data
            if (data.parsed.amount) {
                document.getElementById('ocr-amount').value = data.parsed.amount;
            }
            if (data.parsed.vendor) {
                document.getElementById('ocr-vendor').value = data.parsed.vendor;
            }
            if (data.parsed.date) {
                document.getElementById('ocr-date').value = formatDateForInput(data.parsed.date);
            }
            if (data.parsed.predicted_category) {
                document.getElementById('ocr-category').value = data.parsed.predicted_category;
            }

            document.getElementById('ocr-raw-text').value = data.raw_text;
        } else {
            document.getElementById('ocr-loading').style.display = 'none';
            document.getElementById('upload-area').style.display = 'block';
            alert(data.error || 'OCR processing failed');
        }
    } catch (error) {
        document.getElementById('ocr-loading').style.display = 'none';
        document.getElementById('upload-area').style.display = 'block';
        console.error('OCR error:', error);
        alert('An error occurred during OCR processing');
    }
}

function resetOCR() {
    document.getElementById('ocr-result').style.display = 'none';
    document.getElementById('upload-area').style.display = 'block';
    document.getElementById('ocr-form').reset();
    document.getElementById('receipt-file').value = '';
    document.getElementById('ocr-date').valueAsDate = new Date();
}

async function saveOCRExpense(e) {
    e.preventDefault();

    const amount = document.getElementById('ocr-amount').value;
    const category = document.getElementById('ocr-category').value;
    const description = document.getElementById('ocr-description').value;
    const vendor = document.getElementById('ocr-vendor').value;
    const date = document.getElementById('ocr-date').value;

    try {
        const response = await fetch('/api/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, category, description, vendor, date })
        });

        const data = await response.json();

        if (response.ok) {
            document.getElementById('ocr-success').textContent = 'Expense saved successfully!';

            setTimeout(() => {
                resetOCR();
                document.getElementById('ocr-success').textContent = '';
            }, 2000);

            await loadExpenses();
            await loadAnalytics();
        } else {
            document.getElementById('ocr-error').textContent = data.error || 'Failed to save expense';
        }
    } catch (error) {
        document.getElementById('ocr-error').textContent = 'An error occurred';
        console.error('Error saving OCR expense:', error);
    }
}

// Analytics
async function loadAnalytics() {
    try {
        const response = await fetch('/api/analytics');
        const data = await response.json();

        // Update stats
        document.getElementById('total-spent').textContent = `$${(data.stats.total || 0).toFixed(2)}`;
        document.getElementById('total-count').textContent = data.stats.count || 0;
        document.getElementById('average-expense').textContent = `$${(data.stats.average || 0).toFixed(2)}`;

        // Update charts
        updateCategoryChart(data.by_category);
        updateMonthChart(data.by_month);
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

function updateCategoryChart(data) {
    const ctx = document.getElementById('category-chart');

    if (categoryChart) {
        categoryChart.destroy();
    }

    const colors = [
        '#4f46e5', '#06b6d4', '#10b981', '#f59e0b',
        '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'
    ];

    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.map(d => d.category),
            datasets: [{
                data: data.map(d => d.total),
                backgroundColor: colors,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary')
                    }
                }
            }
        }
    });
}

function updateMonthChart(data) {
    const ctx = document.getElementById('month-chart');

    if (monthChart) {
        monthChart.destroy();
    }

    // Reverse to show oldest to newest
    const reversedData = [...data].reverse();

    monthChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: reversedData.map(d => formatMonth(d.month)),
            datasets: [{
                label: 'Total Spent',
                data: reversedData.map(d => d.total),
                backgroundColor: '#4f46e5',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => '$' + value.toFixed(0),
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary')
                    },
                    grid: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--border-color')
                    }
                },
                x: {
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary')
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Export
async function exportCSV() {
    try {
        window.location.href = '/api/export/csv';
    } catch (error) {
        console.error('Error exporting CSV:', error);
        alert('Failed to export CSV');
    }
}

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatMonth(monthString) {
    const [year, month] = monthString.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}

function formatDateForInput(dateString) {
    try {
        // Try to parse various date formats
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
        }
    } catch (e) {
        console.error('Date parsing error:', e);
    }
    return new Date().toISOString().split('T')[0];
}

