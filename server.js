import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Initialize SQLite Database
// Railway provides persistent storage via Volumes. We check for a volume mount path, otherwise fallback to local.
const dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'database.sqlite')
    : 'database.sqlite';

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Setup DB Tables (Simple example, can be expanded)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );
`);

// Basic API to verify backend status
app.get('/api/status', (req, res) => {
    res.json({ status: 'ok', database: 'connected' });
});

// Serve static React files
app.use(express.static(join(__dirname, 'dist')));

// Handle React Router SPA fallback
app.get('*', (req, res) => {
    res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
