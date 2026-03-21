DROP TABLE IF EXISTS pass_logs CASCADE;
DROP TABLE IF EXISTS approvals CASCADE;
DROP TABLE IF EXISTS gate_pass_requests CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'approver', 'security'))
);

CREATE TABLE IF NOT EXISTS gate_pass_requests (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES users(id),
    date DATE NOT NULL,
    entry_time TIME NOT NULL,
    expected_exit_time TIME NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS approvals (
    id SERIAL PRIMARY KEY,
    request_id INTEGER REFERENCES gate_pass_requests(id),
    approver_id INTEGER REFERENCES users(id),
    decision VARCHAR(20) CHECK (decision IN ('approved', 'rejected')),
    comment TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pass_logs (
    id SERIAL PRIMARY KEY,
    request_id INTEGER REFERENCES gate_pass_requests(id),
    exit_time TIMESTAMP,
    entry_time TIMESTAMP,
    verified_by INTEGER REFERENCES users(id)
);

-- Insert sample data explicitly ignoring if exists
INSERT INTO users (name, email, password, role) VALUES 
('Student One', 'student@gatepass.com', 'password123', 'student'),
('Warden Smith', 'warden@gatepass.com', 'password123', 'approver'),
('Security Guard', 'security@gatepass.com', 'password123', 'security')
ON CONFLICT (email) DO NOTHING;
