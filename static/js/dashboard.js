// Dashboard JavaScript

const CURRENCY = 'AED ';

let expenses = [];
let categories = [];
let categoryChart = null;
let monthChart = null;
let dayChart = null;

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
    loadCachedAIInsights(); // show last AI insights if any (no await)

    // Set default date to today
    document.getElementById('expense-date').valueAsDate = new Date();
    document.getElementById('ocr-date').valueAsDate = new Date();
}

function setupEventListeners() {
    // Navigation (sidebar)
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            switchView(item.dataset.view);
        });
    });

    // Mobile navigation
    const menuToggle = document.getElementById('menu-toggle');
    const menuClose = document.getElementById('menu-close');
    const mobileNavOverlay = document.getElementById('mobile-nav-overlay');
    const mobileNav = document.getElementById('mobile-nav');

    if (menuToggle) {
        menuToggle.addEventListener('click', openMobileNav);
    }
    if (menuClose) {
        menuClose.addEventListener('click', closeMobileNav);
    }
    if (mobileNavOverlay) {
        mobileNavOverlay.addEventListener('click', closeMobileNav);
    }

    document.querySelectorAll('.mobile-nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            switchView(item.dataset.view);
            closeMobileNav();
        });
    });

    // Theme toggle (sidebar + mobile)
    const themeToggle = document.getElementById('theme-toggle');
    const themeToggleMobile = document.getElementById('theme-toggle-mobile');
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
    if (themeToggleMobile) themeToggleMobile.addEventListener('click', toggleTheme);

    // Logout (sidebar + mobile)
    const logoutBtn = document.getElementById('logout-btn');
    const logoutBtnMobile = document.getElementById('logout-btn-mobile');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    if (logoutBtnMobile) logoutBtnMobile.addEventListener('click', logout);

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

    // AI Insights button
    const aiBtn = document.getElementById('ai-insights-btn');
    if (aiBtn) {
        aiBtn.addEventListener('click', loadAIInsights);
    }
}

function openMobileNav() {
    const overlay = document.getElementById('mobile-nav-overlay');
    const nav = document.getElementById('mobile-nav');
    if (overlay) overlay.classList.add('is-open');
    if (nav) nav.classList.add('is-open');
    document.body.style.overflow = 'hidden';
}

function closeMobileNav() {
    const overlay = document.getElementById('mobile-nav-overlay');
    const nav = document.getElementById('mobile-nav');
    if (overlay) overlay.classList.remove('is-open');
    if (nav) nav.classList.remove('is-open');
    document.body.style.overflow = '';
}

function switchView(viewName) {
    // Update sidebar nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === viewName);
    });
    // Update mobile nav
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === viewName);
    });

    // Update views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    const viewEl = document.getElementById(`${viewName}-view`);
    if (viewEl) viewEl.classList.add('active');
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
    if (icon) icon.textContent = theme === 'light' ? '🌙' : '☀️';
    const mobileBtn = document.getElementById('theme-toggle-mobile');
    if (mobileBtn) mobileBtn.textContent = theme === 'light' ? '🌙 Theme' : '☀️ Theme';
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
        tbody.innerHTML = `
            <tr>
                <td colspan="6">
                    <div class="table-empty-state">
                        <div class="empty-icon">💸</div>
                        <div class="empty-title">No expenses yet</div>
                        <div class="empty-desc">Start tracking your spending by adding your first expense.</div>
                        <button class="btn btn-primary" onclick="switchView('add-expense')">➕ Add Expense</button>
                    </div>
                </td>
            </tr>`;
        return;
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    tbody.innerHTML = expenses.map(expense => `
        <tr>
            <td>${formatDate(expense.date)}</td>
            <td><span class="category-badge">${getCategoryIcon(expense.category)} ${escapeHtml(expense.category)}</span></td>
            <td>${escapeHtml(expense.description) || '-'}</td>
            <td>${escapeHtml(expense.vendor) || '-'}</td>
            <td class="amount">${CURRENCY}${parseFloat(expense.amount).toFixed(2)}</td>
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
            if (data.parsed.description) {
                document.getElementById('ocr-description').value = data.parsed.description;
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
        document.getElementById('total-spent').textContent = `${CURRENCY}${(data.stats.total || 0).toFixed(2)}`;
        document.getElementById('total-count').textContent = data.stats.count || 0;
        document.getElementById('average-expense').textContent = `${CURRENCY}${(data.stats.average || 0).toFixed(2)}`;

        // Update charts with empty state handling
        updateCategoryChart(data.by_category);
        updateMonthChart(data.by_month);
        updateDayChart(data.by_day || []);
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

function showChartEmptyState(chartId, emptyId, isEmpty) {
    const canvas = document.getElementById(chartId);
    const empty = document.getElementById(emptyId);
    if (!canvas || !empty) return;

    if (isEmpty) {
        canvas.style.display = 'none';
        empty.classList.add('visible');
    } else {
        canvas.style.display = 'block';
        empty.classList.remove('visible');
    }
}

function updateCategoryChart(data) {
    const isEmpty = !data || data.length === 0;
    showChartEmptyState('category-chart', 'category-empty', isEmpty);
    if (isEmpty) {
        if (categoryChart) { categoryChart.destroy(); categoryChart = null; }
        return;
    }

    const ctx = document.getElementById('category-chart');

    if (categoryChart) {
        categoryChart.destroy();
    }

    const colors = [
        '#22c55e', '#06b6d4', '#f59e0b', '#ef4444',
        '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'
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
    const isEmpty = !data || data.length === 0;
    showChartEmptyState('month-chart', 'month-empty', isEmpty);
    if (isEmpty) {
        if (monthChart) { monthChart.destroy(); monthChart = null; }
        return;
    }

    const ctx = document.getElementById('month-chart');

    if (monthChart) {
        monthChart.destroy();
    }

    const reversedData = [...data].reverse();

    monthChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: reversedData.map(d => formatMonth(d.month)),
            datasets: [{
                label: 'Total Spent',
                data: reversedData.map(d => d.total),
                backgroundColor: '#22c55e',
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
                        callback: (value) => CURRENCY + value.toFixed(0),
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

function updateDayChart(data) {
    const ctx = document.getElementById('day-chart');
    if (!ctx) return;

    const isEmpty = !data || data.length === 0;
    showChartEmptyState('day-chart', 'day-empty', isEmpty);
    if (isEmpty) {
        if (dayChart) { dayChart.destroy(); dayChart = null; }
        return;
    }

    if (dayChart) {
        dayChart.destroy();
    }

    const reversedData = [...data].reverse();

    dayChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: reversedData.map(d => formatDate(d.day)),
            datasets: [{
                label: 'Total Spent',
                data: reversedData.map(d => d.total),
                borderColor: '#22c55e',
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                tension: 0.25,
                fill: true,
                pointRadius: 3,
                pointHoverRadius: 5
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
                        callback: (value) => CURRENCY + value.toFixed(0),
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

// AI Insights — background job + polling (avoids Render free tier ~30s proxy timeout)
function getAIErrorMessage(status) {
    if (status === 502 || status === 504 || status === 0 || status == null) {
        return 'Request timed out. Please try again.';
    }
    return 'Server error. Please try again.';
}

/** Load cached insights on dashboard load (from DB). */
async function loadCachedAIInsights() {
    const placeholder = document.getElementById('ai-insights-placeholder');
    const content = document.getElementById('ai-insights-content');
    if (!placeholder || !content) return;
    try {
        const res = await fetch('/api/ai-insights');
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === 'ready' && data.insights) {
            placeholder.style.display = 'none';
            content.style.display = 'block';
            content.textContent = data.insights;
        } else if (data.status === 'generating') {
            placeholder.style.display = 'none';
            content.style.display = 'block';
            content.textContent = 'AI is analyzing your spending… This may take 60–90 seconds. The page will update automatically.';
            document.getElementById('ai-insights-btn').disabled = true;
            pollAIInsights();
        }
    } catch (_) { /* ignore */ }
}

/** Poll for AI result (called after POST returns status "generating"). */
let aiPollTimer = null;
function pollAIInsights() {
    const btn = document.getElementById('ai-insights-btn');
    const loading = document.getElementById('ai-loading');
    const content = document.getElementById('ai-insights-content');
    const started = Date.now();
    const maxWait = 200000; // ~3.3 min (DeepSeek R1 first token can take 75+ s, full response ~2+ min)

    function stopPolling() {
        if (aiPollTimer) clearInterval(aiPollTimer);
        aiPollTimer = null;
        loading.style.display = 'none';
        if (btn) btn.disabled = false;
    }

    aiPollTimer = setInterval(async () => {
        if (Date.now() - started > maxWait) {
            stopPolling();
            content.style.display = 'block';
            content.textContent = 'Still generating. DeepSeek R1 can take 2+ minutes. Refresh the page in a moment to see your insights if they\'re ready.';
            return;
        }
        try {
            const res = await fetch('/api/ai-insights');
            const data = await res.json();
            if (data.status === 'ready') {
                stopPolling();
                content.style.display = 'block';
                typeText(content, data.insights || '');
            } else if (data.status === 'generating') {
                content.style.display = 'block';
                content.textContent = 'AI is analyzing your spending… (60–90 seconds). Updating automatically.';
            }
        } catch (_) { /* keep polling */ }
    }, 4000);
}

async function loadAIInsights() {
    const btn = document.getElementById('ai-insights-btn');
    const placeholder = document.getElementById('ai-insights-placeholder');
    const loading = document.getElementById('ai-loading');
    const content = document.getElementById('ai-insights-content');

    btn.disabled = true;
    placeholder.style.display = 'none';
    content.style.display = 'none';
    loading.style.display = 'flex';

    try {
        const response = await fetch('/api/ai-insights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        let data;
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const text = await response.text();
            try {
                data = JSON.parse(text);
            } catch {
                data = { error: getAIErrorMessage(response.status) };
            }
        }
        loading.style.display = 'none';

        if (response.ok && data.status === 'generating') {
            content.style.display = 'block';
            content.textContent = data.message || 'AI is analyzing your spending… The page will update automatically in 60–90 seconds.';
            pollAIInsights();
            return;
        }
        if (response.ok && data.insights) {
            content.style.display = 'block';
            typeText(content, data.insights);
            btn.disabled = false;
            return;
        }
        content.style.display = 'block';
        content.textContent = data.error || 'Unable to generate insights. Please try again.';
    } catch (error) {
        console.error('AI insights error:', error);
        loading.style.display = 'none';
        content.style.display = 'block';
        content.textContent = getAIErrorMessage(502);
    } finally {
        btn.disabled = false;
    }
}

function typeText(element, text, speed) {
    speed = speed || 12;
    element.textContent = '';
    let i = 0;

    function type() {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }

    type();
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
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
        }
    } catch (e) {
        console.error('Date parsing error:', e);
    }
    return new Date().toISOString().split('T')[0];
}
