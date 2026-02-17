/* ===== AUTHENTICATION ===== */

let phoneCheckTimer = null;
let emailCheckTimer = null;
let usernameCheckTimer = null;
let gmailCheckTimer = null;
let regFieldsValid = { phone: false, email: false, username: false, password: false };

// Switch auth tabs
function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');

    if (tab === 'login') {
        document.getElementById('loginForm').style.display = 'flex';
        document.getElementById('registerForm').style.display = 'none';
    } else {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'flex';
    }
    hideAuthMessage();
}

// Toggle password visibility
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const btn = input.parentElement.querySelector('.toggle-pass i');
    if (input.type === 'password') {
        input.type = 'text';
        btn.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        btn.className = 'fas fa-eye';
    }
}

// Show auth message
function showAuthMessage(message, type) {
    const el = document.getElementById('authMessage');
    el.textContent = message;
    el.className = `auth-message ${type}`;
}

function hideAuthMessage() {
    const el = document.getElementById('authMessage');
    el.className = 'auth-message';
    el.style.display = 'none';
}

// Field status update
function setFieldStatus(elementId, status, text) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = text;
    el.className = `field-status ${status}`;
}

// Check phone availability (debounced)
function checkPhoneAvailability() {
    const phone = document.getElementById('regPhone').value.trim();
    clearTimeout(phoneCheckTimer);

    if (!phone || phone.length < 6) {
        setFieldStatus('phoneStatus', '', '');
        regFieldsValid.phone = false;
        return;
    }

    if (!/^[0-9]+$/.test(phone)) {
        setFieldStatus('phoneStatus', 'invalid', 'Numbers only');
        regFieldsValid.phone = false;
        return;
    }

    setFieldStatus('phoneStatus', 'checking', 'Checking...');

    phoneCheckTimer = setTimeout(async () => {
        const result = await apiGet('auth', 'check-phone', { phone });
        if (result.success) {
            if (result.available) {
                setFieldStatus('phoneStatus', 'valid', 'Available');
                regFieldsValid.phone = true;
            } else {
                setFieldStatus('phoneStatus', 'invalid', 'Already used');
                regFieldsValid.phone = false;
            }
        }
    }, 600);
}

// Check email availability (debounced)
function checkEmailAvailability() {
    const email = document.getElementById('regEmail').value.trim().toLowerCase();
    clearTimeout(emailCheckTimer);
    clearTimeout(gmailCheckTimer);

    if (!email) {
        setFieldStatus('emailStatus', '', '');
        regFieldsValid.email = false;
        return;
    }

    if (!/^[a-zA-Z0-9._%+-]+$/.test(email.split('@')[0])) {
        setFieldStatus('emailStatus', 'invalid', 'English only');
        regFieldsValid.email = false;
        return;
    }

    if (!email.endsWith('@gmail.com')) {
        if (email.includes('@')) {
            setFieldStatus('emailStatus', 'invalid', 'Gmail only');
        } else {
            setFieldStatus('emailStatus', '', '');
        }
        regFieldsValid.email = false;
        return;
    }

    setFieldStatus('emailStatus', 'checking', 'Checking...');

    emailCheckTimer = setTimeout(async () => {
        // Check database first
        const dbResult = await apiGet('auth', 'check-email', { email });
        if (dbResult.success && !dbResult.available) {
            setFieldStatus('emailStatus', 'invalid', 'Already used');
            regFieldsValid.email = false;
            return;
        }

        // Verify Gmail exists on Google
        setFieldStatus('emailStatus', 'checking', 'Verifying Gmail...');
        gmailCheckTimer = setTimeout(async () => {
            const gmailResult = await apiGet('auth', 'verify-gmail', { email });
            if (gmailResult.success) {
                if (gmailResult.valid) {
                    setFieldStatus('emailStatus', 'valid', 'Valid Gmail');
                    regFieldsValid.email = true;
                } else {
                    setFieldStatus('emailStatus', 'invalid', 'Gmail not found');
                    regFieldsValid.email = false;
                }
            } else {
                // If API fails, allow it
                setFieldStatus('emailStatus', 'valid', 'Available');
                regFieldsValid.email = true;
            }
        }, 300);
    }, 600);
}

// Check username availability (debounced)
function checkUsernameAvailability() {
    const username = document.getElementById('regUsername').value.trim();
    clearTimeout(usernameCheckTimer);

    if (!username) {
        setFieldStatus('usernameStatus', '', '');
        regFieldsValid.username = false;
        return;
    }

    if (/\s/.test(username)) {
        setFieldStatus('usernameStatus', 'invalid', 'No spaces');
        regFieldsValid.username = false;
        return;
    }

    if (!/^[a-zA-Z0-9]+$/.test(username)) {
        setFieldStatus('usernameStatus', 'invalid', 'English only');
        regFieldsValid.username = false;
        return;
    }

    if (username.length < 3) {
        setFieldStatus('usernameStatus', 'invalid', 'Min 3 chars');
        regFieldsValid.username = false;
        return;
    }

    setFieldStatus('usernameStatus', 'checking', 'Checking...');

    usernameCheckTimer = setTimeout(async () => {
        const result = await apiGet('auth', 'check-username', { username });
        if (result.success) {
            if (result.available) {
                setFieldStatus('usernameStatus', 'valid', 'Available');
                regFieldsValid.username = true;
            } else {
                setFieldStatus('usernameStatus', 'invalid', 'Taken');
                regFieldsValid.username = false;
            }
        }
    }, 600);
}

// Password strength checker
function checkPasswordStrength() {
    const password = document.getElementById('regPassword').value;
    const ruleLength = document.getElementById('ruleLength');
    const ruleUpper = document.getElementById('ruleUpper');
    const ruleNumber = document.getElementById('ruleNumber');
    const ruleSpecial = document.getElementById('ruleSpecial');

    const hasLength = password.length >= 6;
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    ruleLength.className = `rule ${hasLength ? 'met' : 'unmet'}`;
    ruleUpper.className = `rule ${hasUpper ? 'met' : 'unmet'}`;
    ruleNumber.className = `rule ${hasNumber ? 'met' : 'unmet'}`;
    ruleSpecial.className = `rule ${hasSpecial ? 'met' : 'unmet'}`;

    ruleLength.querySelector('i').className = hasLength ? 'fas fa-check-circle' : 'fas fa-circle';
    ruleUpper.querySelector('i').className = hasUpper ? 'fas fa-check-circle' : 'fas fa-circle';
    ruleNumber.querySelector('i').className = hasNumber ? 'fas fa-check-circle' : 'fas fa-circle';
    ruleSpecial.querySelector('i').className = hasSpecial ? 'fas fa-check-circle' : 'fas fa-circle';

    const allMet = hasLength && hasUpper && hasNumber && hasSpecial;
    regFieldsValid.password = allMet;

    if (password.length > 0) {
        if (allMet) {
            setFieldStatus('passwordStatus', 'valid', 'Strong');
        } else {
            setFieldStatus('passwordStatus', 'invalid', 'Weak');
        }
    } else {
        setFieldStatus('passwordStatus', '', '');
    }
}

// Handle Login
async function handleLogin() {
    const phone = document.getElementById('loginPhone').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!phone || !password) {
        showAuthMessage('Please enter phone and password', 'error');
        return;
    }

    showAuthMessage('Logging in...', 'loading');

    const deviceId = getDeviceId();
    const ipAddress = await getIPAddress();

    const result = await apiCall('auth', 'login', 'POST', {
        phone, password, deviceId, ipAddress
    });

    if (result.success) {
        saveSession(result.user);
        showAuthMessage('Login successful!', 'success');
        setTimeout(() => {
            showDashboard(result.user);
        }, 800);
    } else {
        showAuthMessage(result.error || 'Login failed', 'error');
    }
}

// Handle Register
async function handleRegister() {
    const phone = document.getElementById('regPhone').value.trim();
    const email = document.getElementById('regEmail').value.trim().toLowerCase();
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value;

    if (!phone || !email || !username || !password) {
        showAuthMessage('All fields are required', 'error');
        return;
    }

    if (!regFieldsValid.phone) {
        showAuthMessage('Please fix phone number', 'error');
        return;
    }
    if (!regFieldsValid.email) {
        showAuthMessage('Please use a valid Gmail address', 'error');
        return;
    }
    if (!regFieldsValid.username) {
        showAuthMessage('Please fix username', 'error');
        return;
    }
    if (!regFieldsValid.password) {
        showAuthMessage('Password does not meet requirements', 'error');
        return;
    }

    showAuthMessage('Creating account...', 'loading');

    const deviceId = getDeviceId();
    const ipAddress = await getIPAddress();

    const result = await apiCall('auth', 'register', 'POST', {
        phone, email, username, password, deviceId, ipAddress
    });

    if (result.success) {
        saveSession(result.user);
        showAuthMessage('Account created successfully!', 'success');
        setTimeout(() => {
            showDashboard(result.user);
        }, 800);
    } else {
        showAuthMessage(result.error || 'Registration failed', 'error');
    }
}

// Show screens
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => {
        s.style.display = 'none';
    });
    document.getElementById(screenId).style.display = '';
}
