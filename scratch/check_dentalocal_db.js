const sqlite3 = require('better-sqlite3');
const path = require('path');

const dbPath = 'c:\\Users\\Hp Vitus Gaming\\Desktop\\dentalocal\\backend\\prisma\\dev.db';
console.log('Opening DB:', dbPath);

try {
    const db = new sqlite3(dbPath);
    const clinics = db.prepare('SELECT id, name, botToken, telegramChatId, ownerPhone, notificationMode FROM Clinic').all();
    console.log('Clinics in DB:', JSON.stringify(clinics, null, 2));
    
    const patients = db.prepare('SELECT id, firstName, lastName, phone, telegramChatId FROM Patient LIMIT 5').all();
    console.log('Patients in DB:', JSON.stringify(patients, null, 2));
} catch (e) {
    console.error('Error reading DB:', e.message);
}
