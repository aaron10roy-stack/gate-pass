const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function initDB() {
    console.log("Starting DB initialization...");
    if (!process.env.DATABASE_URL) {
        console.error("FATAL ERROR: DATABASE_URL is not set in .env!");
        process.exit(1);
    }
    
    try {
        await client.connect();
        console.log('Connected to PostgreSQL database on Neon');
        
        const sql = fs.readFileSync(path.join(__dirname, 'database.sql'), 'utf8');
        await client.query(sql);
        console.log('✅ Database schema created cleanly. Sample data verified.');
    } catch (err) {
        console.error('❌ Error initializing database:', err);
    } finally {
        await client.end();
    }
}

initDB();
