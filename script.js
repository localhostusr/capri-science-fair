// ===== Configuration =====
const CONFIG = {
    // UPDATE THIS: Your Google Apps Script Web App URL after deploying
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbyIbZC3suX1uo8TauPLA2xImDnxveX20aFX0rOZHfaoPDh6O8WjF6kEB9SuM-fsacQW/exec',

    // Sign-up deadline (midnight on this date = closed)
    DEADLINE: new Date('2026-04-11T23:59:59'),

    // Backend is live
    BACKEND_LIVE: true
};

// ===== Language Toggle =====
let currentLang = 'en';

function setLang(lang) {
    currentLang = lang;

    // Update toggle buttons
    document.getElementById('btn-en').classList.toggle('active', lang === 'en');
    document.getElementById('btn-es').classList.toggle('active', lang === 'es');

    // Update all elements with data-en / data-es attributes
    document.querySelectorAll('[data-en]').forEach(el => {
        el.innerHTML = el.getAttribute('data-' + lang) || el.getAttribute('data-en');
    });

    // Update placeholders
    document.querySelectorAll('[data-en-placeholder]').forEach(el => {
        el.placeholder = el.getAttribute('data-' + lang + '-placeholder') || el.getAttribute('data-en-placeholder');
    });

    // Update select options
    document.querySelectorAll('option[data-en]').forEach(el => {
        el.textContent = el.getAttribute('data-' + lang) || el.getAttribute('data-en');
    });

    // Update html lang attribute
    document.documentElement.lang = lang;

    // Update deadline date display
    updateDeadlineDisplay();
}

// ===== Deadline & Countdown =====
function updateDeadlineDisplay() {
    const deadlineEl = document.getElementById('deadline-date');
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const locale = currentLang === 'es' ? 'es-US' : 'en-US';
    deadlineEl.textContent = CONFIG.DEADLINE.toLocaleDateString(locale, options);
}

function updateCountdown() {
    const now = new Date();
    const diff = CONFIG.DEADLINE - now;
    const countdownEl = document.getElementById('countdown');

    if (diff <= 0) {
        // Deadline passed — hide form, show closed message
        document.getElementById('signup-form').style.display = 'none';
        document.getElementById('deadline-banner').style.display = 'none';
        document.getElementById('form-closed').style.display = 'block';
        return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (currentLang === 'es') {
        countdownEl.textContent = `Quedan ${days} día${days !== 1 ? 's' : ''} y ${hours} hora${hours !== 1 ? 's' : ''}`;
    } else {
        countdownEl.textContent = `${days} day${days !== 1 ? 's' : ''} and ${hours} hour${hours !== 1 ? 's' : ''} remaining`;
    }
}

// ===== Group Project Toggle =====
let groupMemberCount = 0;

function toggleGroupFields() {
    const isGroup = document.querySelector('input[name="isGroup"]:checked').value === 'yes';
    const groupFields = document.getElementById('group-fields');
    groupFields.style.display = isGroup ? 'block' : 'none';
    // Auto-add first member row if none exist
    if (isGroup && groupMemberCount === 0) {
        addGroupMember();
    }
}

function addGroupMember() {
    groupMemberCount++;
    const list = document.getElementById('group-members-list');
    const n = groupMemberCount;
    const isEs = currentLang === 'es';

    const member = document.createElement('div');
    member.className = 'group-member-row';
    member.id = 'group-member-' + n;
    member.innerHTML = `
        <div class="group-member-header">
            <strong>${isEs ? 'Miembro' : 'Member'} ${n}</strong>
            <button type="button" class="remove-member-btn" onclick="removeGroupMember(${n})">&times;</button>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>${isEs ? 'Nombre del Estudiante' : 'Student Name'}</label>
                <input type="text" name="gm${n}_studentName" placeholder="${isEs ? 'Nombre y Apellido' : 'First and Last Name'}">
            </div>
            <div class="form-group">
                <label>${isEs ? 'Grado' : 'Grade'}</label>
                <select name="gm${n}_grade">
                    <option value="">${isEs ? 'Grado' : 'Grade'}</option>
                    <option value="K">K</option>
                    <option value="1">1</option><option value="2">2</option>
                    <option value="3">3</option><option value="4">4</option>
                    <option value="5">5</option><option value="6">6</option>
                </select>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>${isEs ? 'Nombre del Padre/Tutor' : 'Parent/Guardian Name'}</label>
                <input type="text" name="gm${n}_parentName" placeholder="${isEs ? 'Nombre y Apellido' : 'First and Last Name'}">
            </div>
            <div class="form-group">
                <label>${isEs ? 'Correo Electrónico' : 'Email'}</label>
                <input type="email" name="gm${n}_parentEmail" placeholder="email@example.com">
            </div>
        </div>
        <div class="form-group">
            <label>${isEs ? 'Teléfono' : 'Phone'}</label>
            <input type="tel" name="gm${n}_parentPhone" placeholder="(555) 555-5555">
        </div>
    `;
    list.appendChild(member);
}

function removeGroupMember(n) {
    const el = document.getElementById('group-member-' + n);
    if (el) el.remove();
}

function collectGroupMembers() {
    const rows = document.querySelectorAll('.group-member-row');
    const members = [];
    rows.forEach(row => {
        const inputs = row.querySelectorAll('input, select');
        const member = {};
        inputs.forEach(input => {
            const name = input.name.replace(/^gm\d+_/, '');
            member[name] = input.value.trim();
        });
        if (member.studentName) {
            members.push(member);
        }
    });
    return JSON.stringify(members);
}

// ===== Form Validation =====
function validateForm(form) {
    let isValid = true;

    // Clear previous errors
    form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
    form.querySelectorAll('.error-text').forEach(el => el.remove());

    // Required text/select fields
    const required = form.querySelectorAll('input[required]:not([type="checkbox"]), textarea[required], select[required]');
    required.forEach(field => {
        if (!field.value.trim()) {
            markError(field, currentLang === 'es' ? 'Este campo es obligatorio' : 'This field is required');
            isValid = false;
        }
    });

    // Consent checkbox
    const consent = form.querySelector('#consent');
    if (consent && !consent.checked) {
        markError(consent, currentLang === 'es' ? 'Debe aceptar para continuar' : 'You must agree to continue');
        isValid = false;
    }

    // Email validation
    const email = form.querySelector('#parent-email');
    if (email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
        markError(email, currentLang === 'es' ? 'Ingrese un correo electrónico válido' : 'Please enter a valid email address');
        isValid = false;
    }

    // Phone validation (optional but if provided, should be reasonable)
    const phone = form.querySelector('#parent-phone');
    if (phone.value && phone.value.replace(/\D/g, '').length < 10) {
        markError(phone, currentLang === 'es' ? 'Ingrese un número de teléfono válido' : 'Please enter a valid phone number');
        isValid = false;
    }

    return isValid;
}

function markError(field, message) {
    field.classList.add('error');
    const errorEl = document.createElement('div');
    errorEl.className = 'error-text';
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    field.parentNode.appendChild(errorEl);

    // Clear error on input
    field.addEventListener('input', function handler() {
        field.classList.remove('error');
        const err = field.parentNode.querySelector('.error-text');
        if (err) err.remove();
        field.removeEventListener('input', handler);
    }, { once: true });
}

// ===== Form Submission =====
document.getElementById('signup-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    if (!validateForm(this)) {
        // Scroll to first error
        const firstError = this.querySelector('.error');
        if (firstError) {
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }

    const submitBtn = document.getElementById('submit-btn');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = currentLang === 'es' ? 'Enviando...' : 'Submitting...';

    // Collect form data
    const formData = {
        studentName: document.getElementById('student-name').value.trim(),
        grade: document.getElementById('grade').value,
        teacher: document.getElementById('teacher').value.trim(),
        isGroup: document.querySelector('input[name="isGroup"]:checked').value,
        groupMembers: collectGroupMembers(),
        projectTitle: document.getElementById('project-title').value.trim(),
        projectDescription: document.getElementById('project-description').value.trim(),
        category: document.getElementById('category').value,
        parentName: document.getElementById('parent-name').value.trim(),
        parentEmail: document.getElementById('parent-email').value.trim(),
        parentPhone: document.getElementById('parent-phone').value.trim(),
        needBoard: document.querySelector('input[name="needBoard"]:checked').value,
        needPower: document.querySelector('input[name="needPower"]:checked').value,
        specialNeeds: document.getElementById('special-needs').value.trim(),
        language: currentLang,
        timestamp: new Date().toISOString()
    };

    if (CONFIG.BACKEND_LIVE) {
        try {
            const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            showSuccess();
        } catch (error) {
            console.error('Submission error:', error);
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
            alert(currentLang === 'es'
                ? 'Hubo un error. Por favor intente de nuevo.'
                : 'Something went wrong. Please try again.');
        }
    } else {
        // Demo mode — simulate submission
        console.log('DEMO MODE — Form data:', formData);
        setTimeout(() => showSuccess(), 1000);
    }
});

function showSuccess() {
    document.getElementById('signup-form').style.display = 'none';
    document.getElementById('deadline-banner').style.display = 'none';
    document.getElementById('form-header').style.display = 'none';
    document.getElementById('success-message').style.display = 'block';
    document.getElementById('success-message').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ===== Duplicate Check (by email) =====
// This is enforced server-side in the Apps Script.
// Client-side we store in sessionStorage to prevent accidental double-submits.
function checkLocalDuplicate(email) {
    const submitted = JSON.parse(sessionStorage.getItem('scienceFairSubmissions') || '[]');
    return submitted.includes(email.toLowerCase());
}

function markLocalSubmission(email) {
    const submitted = JSON.parse(sessionStorage.getItem('scienceFairSubmissions') || '[]');
    submitted.push(email.toLowerCase());
    sessionStorage.setItem('scienceFairSubmissions', JSON.stringify(submitted));
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', function() {
    updateDeadlineDisplay();
    updateCountdown();
    setInterval(updateCountdown, 60000); // Update every minute

    // Group project toggle
    document.querySelectorAll('.group-toggle').forEach(function(radio) {
        radio.addEventListener('change', toggleGroupFields);
    });

    // Add group member button
    var addBtn = document.getElementById('add-member-btn');
    if (addBtn) {
        addBtn.addEventListener('click', function(e) {
            e.preventDefault();
            addGroupMember();
        });
    }

    // Auto-detect language from browser
    const browserLang = navigator.language || navigator.userLanguage;
    if (browserLang.startsWith('es')) {
        setLang('es');
    }
});
