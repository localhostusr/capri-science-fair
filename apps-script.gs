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
const SPREADSHEET_NAME = 'Capri Science Fair 2026 — Sign-Ups';
const ADMIN_EMAILS = ['capriptapresident@gmail.com', 'christopher.kohl@gmail.com', 'tracykohl06@gmail.com', 'vasunanduri@gmail.com'];
const DEADLINE = new Date('2026-04-11T23:59:59');

// ===== Setup (run once) =====
function setup() {
    const ss = SpreadsheetApp.create(SPREADSHEET_NAME);
    const sheet = ss.getActiveSheet();
    sheet.setName('Sign-Ups');

    // Headers
    const headers = [
        'Timestamp',
        'Student Name',
        'Grade',
        'Teacher',
        'Group Project?',
        'Group Members',
        'Project Title',
        'Project Description',
        'Category',
        'Parent Name',
        'Parent Email',
        'Parent Phone',
        'Needs Board?',
        'Needs Power?',
        'Special Needs',
        'Language',
        'Confirmation Sent?'
    ];

    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#1a6b3c')
        .setFontColor('white');

    // Freeze header row
    sheet.setFrozenRows(1);

    // Auto-resize columns
    headers.forEach((_, i) => sheet.autoResizeColumn(i + 1));

    // Create Summary sheet
    const summary = ss.insertSheet('Summary');
    summary.getRange('A1').setValue('Total Sign-Ups');
    summary.getRange('A2').setValue('Group Projects');
    summary.getRange('A3').setValue('Individual Projects');
    summary.getRange('A4').setValue('Boards Needed');
    summary.getRange('A5').setValue('Power Needed');
    summary.getRange('B1').setFormula('=COUNTA(\'Sign-Ups\'!A:A)-1');
    summary.getRange('B2').setFormula('=COUNTIF(\'Sign-Ups\'!E:E,"yes")');
    summary.getRange('B3').setFormula('=COUNTIF(\'Sign-Ups\'!E:E,"no")');
    summary.getRange('B4').setFormula('=COUNTIF(\'Sign-Ups\'!M:M,"yes")');
    summary.getRange('B5').setFormula('=COUNTIF(\'Sign-Ups\'!N:N,"yes")');

    Logger.log('Spreadsheet created: ' + ss.getUrl());
    Logger.log('Share this URL with your team!');

    // Share with admins
    ADMIN_EMAILS.forEach(email => {
        try {
            ss.addEditor(email);
        } catch (e) {
            Logger.log('Could not share with ' + email + ': ' + e.message);
        }
    });
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

// Handle GET requests (for testing)
function doGet(e) {
    return ContentService.createTextOutput(JSON.stringify({
        status: 'ok',
        message: 'Capri Science Fair API is running',
        deadline: DEADLINE.toISOString(),
        signups: getSheet().getLastRow() - 1
    })).setMimeType(ContentService.MimeType.JSON);
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
function notifyAdmins(count) {
    const subject = `🔬 Science Fair Update: ${count} sign-up${count !== 1 ? 's' : ''}!`;
    const body = `The Capri Science Fair 2026 sign-up page has received ${count} registration${count !== 1 ? 's' : ''}.\n\nView all sign-ups in the spreadsheet.`;

    ADMIN_EMAILS.forEach(email => {
        try {
            MailApp.sendEmail(email, subject, body);
        } catch (e) {
            Logger.log('Could not notify ' + email);
        }
    });
}

// ===== Helpers =====
function getSheet() {
    const files = DriveApp.getFilesByName(SPREADSHEET_NAME);
    if (!files.hasNext()) {
        throw new Error('Spreadsheet not found. Run setup() first.');
    }
    const ss = SpreadsheetApp.open(files.next());
    return ss.getSheetByName('Sign-Ups');
}
