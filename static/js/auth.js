// Authentication JavaScript

document.addEventListener('DOMContentLoaded', () => {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginError = document.getElementById('login-error');
    const registerError = document.getElementById('register-error');

    // Tab switching
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;

            // Update active tab
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Show corresponding form
            if (tab === 'login') {
                loginForm.classList.add('active');
                registerForm.classList.remove('active');
            } else {
                registerForm.classList.add('active');
                loginForm.classList.remove('active');
            }

            // Clear error messages
            loginError.textContent = '';
            registerError.textContent = '';
        });
    });

    // Login form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.textContent = '';

        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                window.location.href = '/';
            } else {
                loginError.textContent = data.error || 'Login failed';
            }
        } catch (error) {
            loginError.textContent = 'An error occurred. Please try again.';
            console.error('Login error:', error);
        }
    });

    // Register form submission
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        registerError.textContent = '';

        const username = document.getElementById('register-username').value;
        const password = document.getElementById('register-password').value;
        const confirm = document.getElementById('register-confirm').value;

        // Validate passwords match
        if (password !== confirm) {
            registerError.textContent = 'Passwords do not match';
            return;
        }

        try {
            const response = await fetch('/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                window.location.href = '/';
            } else {
                registerError.textContent = data.error || 'Registration failed';
            }
        } catch (error) {
            registerError.textContent = 'An error occurred. Please try again.';
            console.error('Registration error:', error);
        }
    });
});

