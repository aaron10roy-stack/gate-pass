const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve the frontend

const port = process.env.PORT || 3000;

let pool;
if (process.env.DATABASE_URL) {
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
} else {
    console.warn("⚠️ WARNING: DATABASE_URL not set in .env. Database APIs will fail. Please configure Neon PostgreSQL url.");
}

/* =========================================
   AUTHENTICATION
========================================= */
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT id, name, email, role FROM users WHERE email = $1 AND password = $2', [email, password]);
        if (result.rows.length > 0) {
            res.json({ success: true, user: result.rows[0] });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials. Please verify your email and password.' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server configuration error' });
    }
});

/* =========================================
   STUDENT ROUTES
========================================= */
app.get('/api/requests/student/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM gate_pass_requests WHERE student_id = $1 ORDER BY created_at DESC', [req.params.id]);
        res.json({ success: true, requests: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server configuration error' });
    }
});

app.post('/api/requests', async (req, res) => {
    const { student_id, date, entry_time, expected_exit_time, reason } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO gate_pass_requests (student_id, date, entry_time, expected_exit_time, reason) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [student_id, date, entry_time, expected_exit_time, reason]
        );
        res.json({ success: true, request: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server configuration error' });
    }
});

/* =========================================
   APPROVER ROUTES
========================================= */
app.get('/api/requests/pending', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT r.*, u.name as student_name 
            FROM gate_pass_requests r
            JOIN users u ON r.student_id = u.id
            WHERE r.status = 'pending'
            ORDER BY r.created_at ASC
        `);
        res.json({ success: true, requests: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/requests/:id/approve', async (req, res) => {
    const { approver_id, decision, comment } = req.body; // decision: 'approved' or 'rejected'
    try {
        await pool.query('BEGIN');
        
        // Update request status
        const updateRes = await pool.query(
            'UPDATE gate_pass_requests SET status = $1 WHERE id = $2 RETURNING *',
            [decision, req.params.id]
        );
        
        if (updateRes.rows.length === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        // Insert approval record log
        await pool.query(
            'INSERT INTO approvals (request_id, approver_id, decision, comment) VALUES ($1, $2, $3, $4)',
            [req.params.id, approver_id, decision, comment]
        );

        await pool.query('COMMIT');
        res.json({ success: true, message: `Request ${decision} successfully.` });
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/* =========================================
   SECURITY ROUTES
========================================= */
app.get('/api/requests/:id/verify', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT r.*, u.name as student_name 
            FROM gate_pass_requests r
            JOIN users u ON r.student_id = u.id
            WHERE r.id = $1
        `, [req.params.id]);
        
        if (result.rows.length > 0) {
            res.json({ success: true, request: result.rows[0] });
        } else {
            res.status(404).json({ success: false, message: 'Pass not found or invalid QR code.' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/requests/:id/log', async (req, res) => {
    const { security_id, action } = req.body; // action: 'exit' or 'entry'
    try {
        // Find if any logs exist already
        const logCheck = await pool.query('SELECT * FROM pass_logs WHERE request_id = $1', [req.params.id]);
        
        // Basic workflow validations for Entry System
        if (logCheck.rows.length === 0) {
            if (action === 'entry') {
                const result = await pool.query(
                    'INSERT INTO pass_logs (request_id, entry_time, verified_by) VALUES ($1, CURRENT_TIMESTAMP, $2) RETURNING *',
                    [req.params.id, security_id]
                );
                return res.json({ success: true, log: result.rows[0], message: 'Entry logged successfully.' });
            } else {
                return res.status(400).json({ success: false, message: 'Cannot log exit; resident has not entered yet.' });
            }
        } else {
            if (action === 'exit') {
                if(logCheck.rows[logCheck.rows.length-1].exit_time != null) {
                    return res.status(400).json({ success: false, message: 'Exit from campus is already logged.' });
                }
                const result = await pool.query(
                    'UPDATE pass_logs SET exit_time = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
                    [logCheck.rows[0].id]
                );
                return res.json({ success: true, log: result.rows[0], message: 'Exit logged successfully.' });
            } else {
                return res.status(400).json({ success: false, message: 'Resident has already entered using this pass.' });
            }
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// START
if (require.main === module) {
    app.listen(port, () => {
        console.log(`GatePass Pro server running at http://localhost:${port}`);
    });
}
module.exports = app;
