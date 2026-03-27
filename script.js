// ===== Configuration =====
const CONFIG = {
    // UPDATE THIS: Your Google Apps Script Web App URL after deploying
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycby6vQPTZRSUbpMbbLYL4eHIqGPUMVcHycVaOIqxtbyI4hHQrXnfwKaztFB2vXlBNW8v/exec',

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

// ===== Safety Materials Toggle =====
function toggleSafetyFields() {
    const hasSafety = document.querySelector('input[name="hasSafety"]:checked').value === 'yes';
    const safetyFields = document.getElementById('safety-fields');
    safetyFields.style.display = hasSafety ? 'block' : 'none';
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
        hasSafetyConsiderations: document.querySelector('input[name="hasSafety"]:checked').value,
        safetyDetails: (document.getElementById('safety-details').value || '').trim(),
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

    // Safety materials toggle
    document.querySelectorAll('.safety-toggle').forEach(function(radio) {
        radio.addEventListener('change', toggleSafetyFields);
    });

    // Add group member button
    var addBtn = document.getElementById('add-member-btn');
    if (addBtn) {
        addBtn.addEventListener('click', function(e) {
            e.preventDefault();
            addGroupMember();
        });
    }

    // Lightning strike on consent checkbox
    var consentBox = document.getElementById('consent');
    if (consentBox) {
        consentBox.addEventListener('change', function() {
            if (!this.checked) return;
            var bolt = document.getElementById('lightning-full');
            if (!bolt) return;

            var rect = consentBox.getBoundingClientRect();
            var targetX = rect.left + rect.width / 2;
            var targetY = rect.top + rect.height / 2;

            // Generate a procedural lightning bolt path
            var canvas = bolt.querySelector('.lightning-canvas');
            if (!canvas) {
                canvas = document.createElement('canvas');
                canvas.className = 'lightning-canvas';
                canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;';
                bolt.appendChild(canvas);
            }
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            var ctx = canvas.getContext('2d');

            // Generate bolt segments procedurally
            function generateBolt(x1, y1, x2, y2, depth) {
                var segments = [];
                var dx = x2 - x1;
                var dy = y2 - y1;
                var len = Math.sqrt(dx*dx + dy*dy);
                if (len < 10 || depth > 5) {
                    segments.push({x1:x1, y1:y1, x2:x2, y2:y2, depth:depth});
                    return segments;
                }
                // Midpoint with random offset perpendicular to the line
                var mx = (x1+x2)/2 + (Math.random()-0.5) * len * 0.25;
                var my = (y1+y2)/2 + (Math.random()-0.5) * len * 0.08;
                var left = generateBolt(x1, y1, mx, my, depth);
                var right = generateBolt(mx, my, x2, y2, depth);
                segments = segments.concat(left, right);
                // Random branch
                if (depth < 3 && Math.random() < 0.3) {
                    var bx = mx + (Math.random()-0.5) * len * 0.5;
                    var by = my + len * (0.15 + Math.random()*0.2);
                    var branch = generateBolt(mx, my, bx, by, depth+2);
                    segments = segments.concat(branch);
                }
                return segments;
            }

            // Start from top center-ish, slight random offset, land on checkbox
            var startX = targetX + (Math.random()-0.3) * 100;
            var segments = generateBolt(startX, 0, targetX, targetY, 0);

            // Draw the bolt with multiple passes for glow effect
            function drawBolt(opacity) {
                // Outer glow
                ctx.strokeStyle = 'rgba(200,200,100,' + (0.15 * opacity) + ')';
                ctx.lineWidth = 12;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.beginPath();
                segments.forEach(function(s) {
                    if (s.depth < 3) { ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); }
                });
                ctx.stroke();
                // Mid glow — neon yellow
                ctx.strokeStyle = 'rgba(255,255,80,' + (0.5 * opacity) + ')';
                ctx.lineWidth = 5;
                ctx.beginPath();
                segments.forEach(function(s) {
                    ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2);
                });
                ctx.stroke();
                // Hot core — bright white-yellow
                ctx.strokeStyle = 'rgba(255,255,220,' + (0.9 * opacity) + ')';
                ctx.lineWidth = 2;
                ctx.beginPath();
                segments.forEach(function(s) {
                    if (s.depth < 4) { ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); }
                });
                ctx.stroke();
            }

            // Animate the strike with flicker
            var frame = 0;
            var totalFrames = 30;
            function animateBolt() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                if (frame < totalFrames) {
                    var progress = frame / totalFrames;
                    var opacity;
                    if (progress < 0.1) opacity = 1;
                    else if (progress < 0.15) opacity = 0.2;
                    else if (progress < 0.25) opacity = 0.9;
                    else if (progress < 0.3) opacity = 0.15;
                    else if (progress < 0.4) opacity = 0.7;
                    else opacity = Math.max(0, 1 - (progress - 0.4) / 0.6);

                    // Dark background flash
                    if (progress < 0.2) {
                        ctx.fillStyle = 'rgba(0,0,0,' + (0.3 * (1-progress*5)) + ')';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                    }

                    drawBolt(opacity);

                    // Impact glow at checkbox
                    if (progress < 0.5) {
                        var glowSize = 40 + progress * 80;
                        var glowOpacity = 0.8 * (1 - progress * 2);
                        var grad = ctx.createRadialGradient(targetX, targetY, 0, targetX, targetY, glowSize);
                        grad.addColorStop(0, 'rgba(255,255,180,' + glowOpacity + ')');
                        grad.addColorStop(0.3, 'rgba(255,255,80,' + (glowOpacity*0.5) + ')');
                        grad.addColorStop(1, 'rgba(255,255,80,0)');
                        ctx.fillStyle = grad;
                        ctx.beginPath();
                        ctx.arc(targetX, targetY, glowSize, 0, Math.PI*2);
                        ctx.fill();
                    }

                    frame++;
                    requestAnimationFrame(animateBolt);
                }
            }

            // Smoke canvas — appended to body, not inside lightning-full (which fades out)
            var smokeCanvas = document.querySelector('.smoke-canvas');
            if (!smokeCanvas) {
                smokeCanvas = document.createElement('canvas');
                smokeCanvas.className = 'smoke-canvas';
                smokeCanvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10000;';
                document.body.appendChild(smokeCanvas);
            }
            smokeCanvas.width = window.innerWidth;
            smokeCanvas.height = window.innerHeight;
            var sctx = smokeCanvas.getContext('2d');

            // Smoke particles — large, dramatic, billowing
            var smokeParticles = [];
            for (var si = 0; si < 25; si++) {
                smokeParticles.push({
                    x: targetX + (Math.random() - 0.5) * 20,
                    y: targetY,
                    vx: (Math.random() - 0.5) * 1.0,
                    vy: -(0.5 + Math.random() * 1.0),
                    size: 10 + Math.random() * 20,
                    growRate: 0.5 + Math.random() * 0.6,
                    maxOpacity: 0.35 + Math.random() * 0.2,
                    age: 0,
                    life: 120 + Math.random() * 80
                });
            }

            function animateSmoke() {
                sctx.clearRect(0, 0, smokeCanvas.width, smokeCanvas.height);
                var allDone = true;
                smokeParticles.forEach(function(p) {
                    p.age++;
                    if (p.age > p.life) return;
                    allDone = false;
                    var progress = p.age / p.life;

                    var opacity;
                    if (progress < 0.1) {
                        opacity = p.maxOpacity * (progress / 0.1);
                    } else if (progress < 0.3) {
                        opacity = p.maxOpacity;
                    } else {
                        opacity = p.maxOpacity * (1 - (progress - 0.3) / 0.7);
                    }

                    // Gentle drift and wobble
                    p.x += p.vx + Math.sin(p.age * 0.05) * 0.3;
                    p.y += p.vy;
                    p.vy *= 0.998;
                    p.vx *= 0.999;
                    p.size += p.growRate;
                    p.growRate *= 0.995;

                    sctx.save();
                    sctx.globalAlpha = opacity;
                    // Multiple overlapping circles for soft billowy look
                    for (var layer = 0; layer < 3; layer++) {
                        var lx = p.x + (Math.random() - 0.5) * p.size * 0.3;
                        var ly = p.y + (Math.random() - 0.5) * p.size * 0.2;
                        var ls = p.size * (0.6 + layer * 0.25);
                        var grad = sctx.createRadialGradient(lx, ly, 0, lx, ly, ls);
                        grad.addColorStop(0, 'rgba(70,70,70,0.3)');
                        grad.addColorStop(0.3, 'rgba(90,90,90,0.15)');
                        grad.addColorStop(0.6, 'rgba(110,110,110,0.06)');
                        grad.addColorStop(1, 'rgba(130,130,130,0)');
                        sctx.fillStyle = grad;
                        sctx.beginPath();
                        sctx.arc(lx, ly, ls, 0, Math.PI * 2);
                        sctx.fill();
                    }
                    sctx.restore();
                });
                if (!allDone) {
                    requestAnimationFrame(animateSmoke);
                } else {
                    sctx.clearRect(0, 0, smokeCanvas.width, smokeCanvas.height);
                }
            }

            bolt.classList.remove('struck');
            void bolt.offsetWidth;
            bolt.classList.add('struck');
            animateBolt();
            // Start smoke after the initial bolt flash
            setTimeout(function() { animateSmoke(); }, 500);
            setTimeout(function() {
                bolt.classList.remove('struck');
                if (canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
            }, 5000);
        });
    }

    // Auto-detect language from browser
    const browserLang = navigator.language || navigator.userLanguage;
    if (browserLang.startsWith('es')) {
        setLang('es');
    }
});
