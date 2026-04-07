/**
 * Capri Science Fair 2026 — Google Apps Script Backend
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to https://script.google.com and create a new project
 * 2. Paste this entire file into Code.gs
 * 3. Run the setup() function once (it will create the spreadsheet)
 * 4. Deploy > New Deployment > Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the Web App URL and paste it into script.js CONFIG.APPS_SCRIPT_URL
 * 6. Set CONFIG.BACKEND_LIVE = true in script.js
 */

// ===== Configuration =====
// LOCKED to a specific spreadsheet ID so the script can never accidentally
// create or attach to a different sheet. DO NOT change this without also
// updating the actual sheet it points to.
const SPREADSHEET_ID = '1MdSP6gHM4ARZlQekV2MleN_z81r0hbm0IkBb4UYpA-E';
const SPREADSHEET_NAME = 'Capri Science Fair 2026 — Sign-Ups';
// Admins who have access to the spreadsheet (used for sharing on setup)
const ADMIN_EMAILS = ['capriptapresident@gmail.com', 'christopher.kohl@gmail.com', 'tracykohl06@gmail.com', 'vasunanduri@gmail.com'];
// Notification recipients — only Chris gets sign-up notification emails
const NOTIFY_EMAILS = ['christopher.kohl@gmail.com'];
const DEADLINE = new Date('2026-04-11T23:59:59');

// ===== Setup (DISABLED — spreadsheet already exists and is locked by ID) =====
// This function is intentionally a no-op that throws. The original setup logic
// has been removed to prevent accidental sheet creation. If you need to recreate
// the sheet, do it manually and update SPREADSHEET_ID above.
function setup() {
    throw new Error('setup() is disabled. Spreadsheet is locked to ID: ' + SPREADSHEET_ID);
}

// ===== Web App Entry Point =====
function doPost(e) {
    try {
        const data = JSON.parse(e.postData.contents);

        // Check deadline
        if (new Date() > DEADLINE) {
            return ContentService.createTextOutput(JSON.stringify({
                status: 'error',
                message: 'Sign-ups are closed'
            })).setMimeType(ContentService.MimeType.JSON);
        }

        // Check for duplicates (by email + student name)
        const sheet = getSheet();
        const existing = sheet.getDataRange().getValues();
        const isDuplicate = existing.some(row =>
            row[1]?.toString().toLowerCase() === data.studentName?.toLowerCase() &&
            row[10]?.toString().toLowerCase() === data.parentEmail?.toLowerCase()
        );

        if (isDuplicate) {
            return ContentService.createTextOutput(JSON.stringify({
                status: 'duplicate',
                message: 'This student has already been signed up'
            })).setMimeType(ContentService.MimeType.JSON);
        }

        // Write to spreadsheet
        sheet.appendRow([
            new Date().toLocaleString(),
            data.studentName,
            data.grade,
            data.teacher,
            data.isGroup,
            data.groupMembers || '',
            data.projectTitle,
            data.projectDescription,
            data.category || '',
            data.parentName,
            data.parentEmail,
            data.parentPhone || '',
            data.needBoard,
            data.needPower,
            data.specialNeeds || '',
            data.language || 'en',
            'pending'
        ]);

        // Confirmation email DISABLED to avoid exposing admin's personal email
        // sendConfirmationEmail(data);

        // Update confirmation status
        const lastRow = sheet.getLastRow();
        sheet.getRange(lastRow, 17).setValue('disabled');

        // Notify admins (only on first sign-up, then every 5th)
        const totalSignups = lastRow - 1;
        if (totalSignups === 1 || totalSignups % 5 === 0) {
            notifyAdmins(totalSignups);
        }

        return ContentService.createTextOutput(JSON.stringify({
            status: 'success',
            message: 'Signed up successfully'
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        Logger.log('Error: ' + error.message);
        return ContentService.createTextOutput(JSON.stringify({
            status: 'error',
            message: error.message
        })).setMimeType(ContentService.MimeType.JSON);
    }
}

// Handle GET requests
function doGet(e) {
    const params = (e && e.parameter) ? e.parameter : {};
    const action = params.action || null;

    // Stats endpoint — public, returns aggregated counts only
    if (action === 'stats') {
        return jsonOut(getStats());
    }

    // Organizer stats — deeper analytics + visit tracking metrics
    if (action === 'organizer-stats') {
        return jsonOut(getOrganizerStats());
    }

    // Visit tracking — fire-and-forget ping from browsers
    if (action === 'visit') {
        try {
            recordVisit({
                sid: params.sid || '',
                page: params.page || 'unknown'
            });
        } catch (err) { /* silent */ }
        return jsonOut({ ok: true });
    }

    // Default health check
    return jsonOut({
        status: 'ok',
        message: 'Capri Science Fair API is running',
        deadline: DEADLINE.toISOString(),
        signups: getSheet().getLastRow() - 1
    });
}

function jsonOut(obj) {
    return ContentService.createTextOutput(JSON.stringify(obj))
        .setMimeType(ContentService.MimeType.JSON);
}

// ===== Aggregated Stats (no PII) =====
function getStats() {
    const sheet = getSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
        return {
            total: 0, students: 0,
            byGrade: {}, byCategory: {},
            groupCount: 0, individualCount: 0,
            boardsNeeded: 0, powerNeeded: 0,
            languages: { en: 0, es: 0 },
            updatedAt: new Date().toISOString()
        };
    }

    const data = sheet.getRange(2, 1, lastRow - 1, 17).getValues();
    const stats = {
        total: 0,           // total form submissions
        students: 0,        // total students participating (incl. group members)
        byGrade: {},
        byCategory: {},
        groupCount: 0,
        individualCount: 0,
        boardsNeeded: 0,
        powerNeeded: 0,
        languages: { en: 0, es: 0 },
        updatedAt: new Date().toISOString()
    };

    data.forEach(row => {
        const grade = String(row[2] || 'Unknown');
        const isGroup = String(row[4] || '').toLowerCase() === 'yes';
        const groupMembersJson = row[5];
        const category = String(row[8] || 'uncategorized');
        const needsBoard = String(row[12] || '').toLowerCase() === 'yes';
        const needsPower = String(row[13] || '').toLowerCase() === 'yes';
        const language = String(row[15] || 'en').toLowerCase();

        stats.total++;
        stats.students++; // the lead student
        stats.byGrade[grade] = (stats.byGrade[grade] || 0) + 1;
        stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;

        if (isGroup) {
            stats.groupCount++;
            // Count additional group members
            if (groupMembersJson) {
                try {
                    const members = JSON.parse(groupMembersJson);
                    if (Array.isArray(members)) {
                        stats.students += members.length;
                        members.forEach(m => {
                            if (m && m.grade) {
                                const g = String(m.grade);
                                stats.byGrade[g] = (stats.byGrade[g] || 0) + 1;
                            }
                        });
                    }
                } catch (e) { /* ignore parse errors */ }
            }
        } else {
            stats.individualCount++;
        }

        if (needsBoard) stats.boardsNeeded++;
        if (needsPower) stats.powerNeeded++;
        if (language === 'es') stats.languages.es++;
        else stats.languages.en++;
    });

    return stats;
}

// ===== Visit Tracking =====
function getVisitsSheet() {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName('Visits');
    if (!sheet) {
        sheet = ss.insertSheet('Visits');
        sheet.getRange(1, 1, 1, 3).setValues([['Timestamp','SessionID','Page']]);
        sheet.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#1a6b3c').setFontColor('white');
        sheet.setFrozenRows(1);
    }
    return sheet;
}

function recordVisit(v) {
    const sheet = getVisitsSheet();
    sheet.appendRow([new Date(), v.sid, v.page]);
}

// ===== Organizer Stats — deeper analytics =====
function getOrganizerStats() {
    const baseStats = getStats();
    const signupsSheet = getSheet();
    const lastRow = signupsSheet.getLastRow();

    // Daily sign-up trend
    const byDay = {};
    if (lastRow >= 2) {
        const data = signupsSheet.getRange(2, 1, lastRow - 1, 17).getValues();
        data.forEach(row => {
            const ts = row[0];
            if (!ts) return;
            const d = (ts instanceof Date) ? ts : new Date(ts);
            if (isNaN(d.getTime())) return;
            const key = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
            byDay[key] = (byDay[key] || 0) + 1;
        });
    }

    // Visit metrics — count UNIQUE browsers only (one per session ID, ever)
    const visitsSheet = getVisitsSheet();
    const vLast = visitsSheet.getLastRow();
    const visitMetrics = {
        uniqueVisitors: 0,
        firstSeenToday: 0,
        firstSeenLast7Days: 0,
        firstSeenByDay: {}
    };

    if (vLast >= 2) {
        const visits = visitsSheet.getRange(2, 1, vLast - 1, 3).getValues();
        const firstSeen = {}; // sid -> earliest timestamp
        visits.forEach(row => {
            const ts = row[0];
            const sid = String(row[1] || '');
            if (!sid) return;
            const d = (ts instanceof Date) ? ts : new Date(ts);
            if (isNaN(d.getTime())) return;
            if (!firstSeen[sid] || d < firstSeen[sid]) firstSeen[sid] = d;
        });

        const now = new Date();
        const todayStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        Object.keys(firstSeen).forEach(sid => {
            const d = firstSeen[sid];
            visitMetrics.uniqueVisitors++;
            const dayKey = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
            visitMetrics.firstSeenByDay[dayKey] = (visitMetrics.firstSeenByDay[dayKey] || 0) + 1;
            if (dayKey === todayStr) visitMetrics.firstSeenToday++;
            if (d >= sevenDaysAgo) visitMetrics.firstSeenLast7Days++;
        });
    }

    // Conversion rate (sign-ups / unique visitors)
    const conversion = visitMetrics.uniqueVisitors > 0
        ? (baseStats.total / visitMetrics.uniqueVisitors * 100)
        : 0;

    // Days remaining + projected total at current rate
    const now = new Date();
    const daysRemaining = Math.max(0, Math.ceil((DEADLINE - now) / (1000 * 60 * 60 * 24)));
    const daysSinceFirstSignup = (function() {
        const days = Object.keys(byDay).sort();
        if (days.length === 0) return 0;
        const first = new Date(days[0]);
        return Math.max(1, Math.ceil((now - first) / (1000 * 60 * 60 * 24)));
    })();
    const dailyRate = daysSinceFirstSignup > 0 ? baseStats.total / daysSinceFirstSignup : 0;
    const projectedTotal = Math.round(baseStats.total + (dailyRate * daysRemaining));

    // Recommendations — under-represented grades & empty categories
    // Only generate "under-represented" recommendations with enough data (>=7 entries)
    // so we don't say "6 grades under-represented" with 1 sign-up
    const totalGradeEntries = Object.values(baseStats.byGrade).reduce((a, b) => a + b, 0);
    let underGrades = [];
    if (totalGradeEntries >= 7) {
        const expectedPerGrade = totalGradeEntries / 7;
        underGrades = ['K','1','2','3','4','5','6'].filter(g => (baseStats.byGrade[g] || 0) < expectedPerGrade);
    } else {
        // Below threshold — list grades that are completely empty
        underGrades = ['K','1','2','3','4','5','6'].filter(g => !(baseStats.byGrade[g] > 0));
    }

    const allCats = ['clean-water','energy','food','sustainability','health','space','animals','engineering','other'];
    const emptyCats = allCats.filter(c => !(baseStats.byCategory[c] > 0));

    return {
        base: baseStats,
        byDay: byDay,
        visits: visitMetrics,
        conversion: conversion,
        deadline: DEADLINE.toISOString(),
        daysRemaining: daysRemaining,
        dailyRate: dailyRate,
        projectedTotal: projectedTotal,
        recommendations: {
            underGrades: underGrades,
            emptyCategories: emptyCats
        },
        updatedAt: new Date().toISOString()
    };
}

// ===== Confirmation Email =====
function sendConfirmationEmail(data) {
    const isSpanish = data.language === 'es';

    const subject = isSpanish
        ? '✅ Confirmación — Feria de Ciencias de Capri 2026'
        : '✅ Confirmed — Capri Science Fair 2026';

    const body = isSpanish ? `
¡Hola ${data.parentName}!

¡${data.studentName} está inscrito/a en la Feria de Ciencias de Capri 2026!

📋 DETALLES DE SU INSCRIPCIÓN:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Estudiante: ${data.studentName}
Grado: ${data.grade}
Maestro/a: ${data.teacher}
Proyecto: "${data.projectTitle}"
Proyecto en grupo: ${data.isGroup === 'yes' ? 'Sí' : 'No'}
${data.isGroup === 'yes' && data.groupMembers ? 'Miembros del grupo: ' + data.groupMembers : ''}
Necesita tablero: ${data.needBoard === 'yes' ? 'Sí' : 'No'}
Necesita electricidad: ${data.needPower === 'yes' ? 'Sí' : 'No'}

📅 DETALLES DEL EVENTO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Fecha: Jueves, 23 de abril de 2026
Hora: 5:00 PM – 6:30 PM
Lugar: Patio de Capri Elementary

HORARIO:
• 5:00 PM — Proyectos y estaciones interactivas de SD Lab Rats
• 6:00 PM — Show de ciencias de SD Lab Rats
• 6:30 PM — Fin del evento

📌 QUÉ TRAER:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Su proyecto de ciencias completado
${data.needBoard === 'yes' ? '• Recoja su tablero tríptico de la Sra. Pudvah antes del evento' : '• Su propio tablero de exhibición'}
• Llegue a las 4:45 PM para montar su proyecto

📘 GUÍA DE INICIO RÁPIDO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
¿Necesita ayuda con su proyecto? Nuestra guía tiene ideas de proyectos, consejos para el tablero y más:
https://localhostusr.github.io/capri-science-fair/guide.html

🔒 PRIVACIDAD: Su información se utiliza únicamente para coordinar la Feria de Ciencias y se eliminará dentro de los 30 días posteriores al evento.

¿Preguntas? Responda a este correo o contacte capriptapresident@gmail.com

¡Nos vemos en la Feria de Ciencias!
Capri Elementary PTA
"La Ciencia Nos Une" 🔬
` : `
Hi ${data.parentName}!

${data.studentName} is signed up for the Capri Science Fair 2026!

📋 YOUR SIGN-UP DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Student: ${data.studentName}
Grade: ${data.grade}
Teacher: ${data.teacher}
Project: "${data.projectTitle}"
Group project: ${data.isGroup === 'yes' ? 'Yes' : 'No'}
${data.isGroup === 'yes' && data.groupMembers ? 'Group members: ' + data.groupMembers : ''}
Needs board: ${data.needBoard === 'yes' ? 'Yes' : 'No'}
Needs electricity: ${data.needPower === 'yes' ? 'Yes' : 'No'}

📅 EVENT DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Date: Thursday, April 23, 2026
Time: 5:00 PM – 6:30 PM
Location: Capri Elementary Quad

SCHEDULE:
• 5:00 PM — Projects & SD Lab Rats interactive stations
• 6:00 PM — SD Lab Rats science show
• 6:30 PM — Event ends

📌 WHAT TO BRING:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Your completed science project
${data.needBoard === 'yes' ? '• Pick up your tri-fold board from Ms. Pudvah before the event' : '• Your own display board'}
• Arrive by 4:45 PM to set up your project

📘 QUICK START GUIDE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Need help with your project? Our guide has project ideas, board tips, and more:
https://localhostusr.github.io/capri-science-fair/guide.html

🔒 PRIVACY: Your information is used solely to coordinate Science Fair participation and will be deleted within 30 days after the event.

Questions? Reply to this email or contact capriptapresident@gmail.com

See you at the Science Fair!
Capri Elementary PTA
"Science Brings Us Together" 🔬
`;

    MailApp.sendEmail({
        to: data.parentEmail,
        subject: subject,
        body: body,
        replyTo: ADMIN_EMAILS[0]
    });
}

// ===== Admin Notification =====
// Only Chris gets these (NOTIFY_EMAILS) to avoid spamming Rose, Tracy, Mr. Nanduri.
function notifyAdmins(count) {
    const subject = `🔬 Science Fair Update: ${count} sign-up${count !== 1 ? 's' : ''}!`;
    const body = `The Capri Science Fair 2026 sign-up page has received ${count} registration${count !== 1 ? 's' : ''}.\n\nView all sign-ups in the spreadsheet.`;

    NOTIFY_EMAILS.forEach(email => {
        try {
            MailApp.sendEmail(email, subject, body);
        } catch (e) {
            Logger.log('Could not notify ' + email);
        }
    });
}

// ===== Helpers =====
function getSheet() {
    // Lock to specific spreadsheet ID — no searching by name
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    return ss.getSheetByName('Sign-Ups');
}
