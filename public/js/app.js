const API_URL = '/api';
let currentUser = null;
let currentPassId = null; // Used for security scanning

const app = {
    init() {
        // Recover user from local storage if exists
        const storedUser = localStorage.getItem('gatepass_user');
        if (storedUser) {
            currentUser = JSON.parse(storedUser);
            this.route();
        } else {
            this.renderView('tmpl-login');
            this.bindLogin();
        }
    },
    
    route() {
        if (!currentUser) {
            this.renderView('tmpl-login');
            this.bindLogin();
            return;
        }
        
        if (currentUser.role === 'student') {
            this.renderView('tmpl-student');
            this.bindStudent();
        } else if (currentUser.role === 'approver') {
            this.renderView('tmpl-approver');
            this.bindApprover();
        } else if (currentUser.role === 'security') {
            this.renderView('tmpl-security');
            this.bindSecurity();
        }
    },
    
    renderView(templateId) {
        const appDiv = document.getElementById('app');
        const template = document.getElementById(templateId);
        if(template) {
            appDiv.innerHTML = template.innerHTML;
        } else {
            console.error(`Template ${templateId} not found.`);
        }
    },
    
    logout() {
        currentUser = null;
        localStorage.removeItem('gatepass_user');
        this.route();
    },

    async fetchAPI(endpoint, options = {}) {
        try {
            const res = await fetch(`${API_URL}${endpoint}`, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            return await res.json();
        } catch (err) {
            console.error('API Error:', err);
            return { success: false, message: 'Network error. Please ensure the backend server is running.' };
        }
    },

    /* ==========================================
       LOGIN MODULE
    ========================================== */
    bindLogin() {
        const form = document.getElementById('login-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const btn = form.querySelector('button');
            btn.innerText = 'Signing In...';
            btn.disabled = true;
            
            const res = await this.fetchAPI('/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });
            
            btn.innerText = 'Sign In';
            btn.disabled = false;
            
            if (res.success) {
                currentUser = res.user;
                localStorage.setItem('gatepass_user', JSON.stringify(currentUser));
                this.route();
            } else {
                document.getElementById('login-error').innerText = res.message;
            }
        });
    },

    /* ==========================================
       STUDENT MODULE
    ========================================== */
    bindStudent() {
        this.loadStudentHistory();
        
        // Handle New Pass Request Form
        const form = document.getElementById('request-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const date = document.getElementById('req-date').value;
            const entry_time = document.getElementById('req-entry').value;
            const expected_exit_time = document.getElementById('req-exit').value;
            const reason = document.getElementById('req-reason').value;
            const btn = form.querySelector('button');
            const msgObj = document.getElementById('req-msg');
            
            btn.innerText = 'Submitting...';
            btn.disabled = true;
            
            const res = await this.fetchAPI('/requests', {
                method: 'POST',
                body: JSON.stringify({
                    student_id: currentUser.id,
                    date, entry_time, expected_exit_time, reason
                })
            });
            
            btn.innerText = 'Submit Request';
            btn.disabled = false;
            
            if (res.success) {
                msgObj.innerHTML = '<span style="color:var(--success)">✅ Request submitted successfully!</span>';
                form.reset();
                this.loadStudentHistory();
                setTimeout(() => msgObj.innerHTML = '', 3000);
            } else {
                msgObj.innerHTML = `<span style="color:var(--danger)">❌ ${res.message}</span>`;
            }
        });
    },
    
    async loadStudentHistory() {
        const res = await this.fetchAPI(`/requests/student/${currentUser.id}`);
        if(res.success) {
            const tbody = document.getElementById('student-requests-list');
            if(!tbody) return;
            tbody.innerHTML = '';
            
            if (res.requests.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-secondary);">No pass history found.</td></tr>';
            }
            
            res.requests.forEach(req => {
                let actionBtn = '-';
                // Only show QR if approved
                if(req.status === 'approved') {
                    actionBtn = `<button class="btn-sm btn-success" onclick="app.showQR(${req.id})">Show QR</button>`;
                }
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${new Date(req.date).toLocaleDateString()}</td>
                    <td>${req.entry_time.substring(0,5)}</td>
                    <td><span class="badge ${req.status}">${req.status.toUpperCase()}</span></td>
                    <td>${actionBtn}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    },
    
    showQR(passId) {
        const modal = document.getElementById('qr-modal');
        const qrContainer = document.getElementById('qrcode-display');
        qrContainer.innerHTML = ''; // Clear previous QR
        
        // Use qrcode.js to generate QR for the passId
        new QRCode(qrContainer, {
            text: `gatepass_id:${passId}`,
            width: 180,
            height: 180,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
        
        document.getElementById('qr-pass-info').innerText = `Pass ID: ${passId}`;
        modal.classList.remove('hidden');
    },

    closeModal() {
        document.getElementById('qr-modal').classList.add('hidden');
    },

    /* ==========================================
       APPROVER (WARDEN/HOD) MODULE
    ========================================== */
    bindApprover() {
        this.loadPendingRequests();
    },
    
    async loadPendingRequests() {
        const res = await this.fetchAPI('/requests/pending');
        if(res.success) {
            const tbody = document.getElementById('approver-requests-list');
            if(!tbody) return;
            tbody.innerHTML = '';
            
            if (res.requests.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-secondary);">No pending requests at the moment.</td></tr>';
            }
            
            res.requests.forEach(req => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${req.student_name}</strong></td>
                    <td>${new Date(req.date).toLocaleDateString()}</td>
                    <td><div class="badge fade-in" style="background:rgba(255,255,255,0.1); color:white; border:none; padding:4px 8px;">${req.entry_time.substring(0,5)} - ${req.expected_exit_time.substring(0,5)}</div></td>
                    <td>${req.reason}</td>
                    <td>
                        <div class="action-buttons" style="margin-top:0;">
                            <button class="btn-sm btn-success" onclick="app.processRequest(${req.id}, 'approved')">Approve</button>
                            <button class="btn-sm btn-danger" onclick="app.processRequest(${req.id}, 'rejected')">Reject</button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    },
    
    async processRequest(id, decision) {
        const res = await this.fetchAPI(`/requests/${id}/approve`, {
            method: 'POST',
            body: JSON.stringify({
                approver_id: currentUser.id,
                decision: decision,
                comment: 'Processed via Web Dashboard'
            })
        });
        
        if(res.success) {
            this.loadPendingRequests();
        } else {
            alert(res.message);
        }
    },

    /* ==========================================
       SECURITY MODULE
    ========================================== */
    bindSecurity() {
        // UI event handlers can be added here if needed
        // Simulation handles on-click verifyPassManual()
    },
    
    async verifyPassManual() {
        const input = document.getElementById('manual-pass-id').value;
        // Strip the payload prefix if they paste it exactly, or just take the ID
        const passId = input.replace('gatepass_id:', '').trim(); 
        
        if(!passId) return;
        
        const btn = (typeof event !== 'undefined' && event.target) ? event.target : null;
        if(btn) btn.innerText = 'Verifying...';
        
        const res = await this.fetchAPI(`/requests/${passId}/verify`);
        
        if(btn) btn.innerText = 'Verify';
        
        const resultBox = document.getElementById('verification-result');
        const vrStatus = document.getElementById('vr-status');
        const vrDetails = document.getElementById('vr-details');
        const actionsBox = document.getElementById('action-buttons-sec');
        
        resultBox.classList.remove('hidden');
        document.getElementById('vr-msg').innerHTML = '';
        
        if (res.success) {
            currentPassId = passId;
            const req = res.request;
            
            if (req.status === 'approved') {
                vrStatus.innerHTML = '<span style="color:var(--success)">✅ Pass is Valid & Approved</span>';
                vrDetails.innerHTML = `
                    <br><strong>Student:</strong> ${req.student_name}
                    <br><strong>Date:</strong> ${new Date(req.date).toLocaleDateString()}
                    <br><strong>Time Window:</strong> ${req.entry_time.substring(0,5)} - ${req.expected_exit_time.substring(0,5)}
                    <br><strong>Reason:</strong> ${req.reason}
                `;
                actionsBox.classList.remove('hidden');
            } else {
                vrStatus.innerHTML = `<span style="color:var(--danger)">❌ Pass is Invalid (${req.status.toUpperCase()})</span>`;
                vrDetails.innerHTML = 'This pass cannot be used to exit the gate.';
                actionsBox.classList.add('hidden');
                currentPassId = null;
            }
        } else {
            vrStatus.innerHTML = '<span style="color:var(--danger)">❌ Pass Not Found</span>';
            vrDetails.innerHTML = res.message;
            actionsBox.classList.add('hidden');
            currentPassId = null;
        }
    },
    
    async logAction(action) {
        if(!currentPassId) return;
        
        const res = await this.fetchAPI(`/requests/${currentPassId}/log`, {
            method: 'POST',
            body: JSON.stringify({
                security_id: currentUser.id,
                action: action
            })
        });
        
        const msgDiv = document.getElementById('vr-msg');
        if (res.success) {
            msgDiv.innerHTML = `<span style="color:var(--success)">✅ Gate pass ${action} logged successfully!</span>`;
        } else {
            msgDiv.innerHTML = `<span style="color:var(--danger)">❌ Error: ${res.message}</span>`;
        }
    }
};

// Initialize App
window.onload = () => app.init();
