const socket = io();

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    loadReports(); // Load dashboard stats immediately
});

// Socket Listeners
socket.on('new_order', () => {
    loadReports();
    // Only refresh products if we are looking at the menu to save bandwidth
    if(document.getElementById('menu').classList.contains('active')) loadProducts();
});

// --- 1. MENU LOGIC ---
function loadProducts() {
    fetch('/api/products')
        .then(res => res.json())
        .then(products => {
            const tbody = document.getElementById('productTableBody');
            tbody.innerHTML = '';
            products.forEach(p => {
                tbody.innerHTML += `
                    <tr>
                        <td><div class="fw-bold">${p.name}</div></td>
                        <td><span class="badge bg-light text-dark border">${p.category}</span></td>
                        <td>${p.stock_quantity}</td>
                        <td>$${p.price}</td>
                        <td>
                            <button class="btn btn-sm btn-light text-primary" onclick='openEditModal(${JSON.stringify(p)})'><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-sm btn-light text-danger" onclick="deleteProduct(${p.id})"><i class="bi bi-trash"></i></button>
                        </td>
                    </tr>`;
            });
        });
}

document.getElementById('addProductForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
        name: document.getElementById('pName').value,
        stock_quantity: document.getElementById('pStock').value,
        price: document.getElementById('pPrice').value,
        category: document.getElementById('pCategory').value,
        image_url: ''
    };
    fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }).then(() => {
        document.getElementById('addProductForm').reset();
        // Close collapse (Bootstrap 5 API)
        new bootstrap.Collapse(document.getElementById('addProdCollapse')).hide();
        loadProducts();
    });
});

function deleteProduct(id) {
    if(confirm('Delete this item?')) {
        fetch(`/api/products/${id}`, { method: 'DELETE' }).then(() => loadProducts());
    }
}

// Edit Modal Logic
let editModal;
function openEditModal(p) {
    document.getElementById('edit-id').value = p.id;
    document.getElementById('edit-name').value = p.name;
    document.getElementById('edit-price').value = p.price;
    document.getElementById('edit-stock').value = p.stock_quantity;
    document.getElementById('edit-category').value = p.category;
    
    editModal = new bootstrap.Modal(document.getElementById('editProductModal'));
    editModal.show();
}

document.getElementById('editProductForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const data = {
        name: document.getElementById('edit-name').value,
        price: document.getElementById('edit-price').value,
        stock_quantity: document.getElementById('edit-stock').value,
        category: document.getElementById('edit-category').value
    };
    fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }).then(() => {
        editModal.hide();
        loadProducts();
    });
});


// --- 2. USER LOGIC ---
function loadUsers() {
    fetch('/api/users')
        .then(res => res.json())
        .then(users => {
            const tbody = document.getElementById('usersTableBody');
            tbody.innerHTML = '';
            users.forEach(u => {
                tbody.innerHTML += `
                    <tr>
                        <td>${u.id}</td>
                        <td>${u.username}</td>
                        <td><span class="badge bg-primary">${u.role}</span></td>
                        <td>
                            <button class="btn btn-sm btn-light text-primary" onclick='openEditUserModal(${JSON.stringify(u)})'><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-sm btn-light text-danger" onclick="deleteUser(${u.id})"><i class="bi bi-trash"></i></button>
                        </td>
                    </tr>`;
            });
        });
}

// Edit User Modal Logic
let editUserModalInstance;
function openEditUserModal(user) {
    document.getElementById('edit-user-id').value = user.id;
    document.getElementById('edit-user-name').value = user.username;
    document.getElementById('edit-user-role').value = user.role;
    
    editUserModalInstance = new bootstrap.Modal(document.getElementById('editUserModal'));
    editUserModalInstance.show();
}

document.getElementById('editUserForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-user-id').value;
    const data = {
        username: document.getElementById('edit-user-name').value,
        role: document.getElementById('edit-user-role').value
    };
    fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }).then(() => {
        editUserModalInstance.hide();
        loadUsers();
    });
});

document.getElementById('addUserForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
        username: document.getElementById('uName').value,
        password: document.getElementById('uPass').value, // plaintext for now
        role: document.getElementById('uRole').value
    };
    fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }).then(() => {
        document.getElementById('addUserForm').reset();
        loadUsers();
    });
});

function deleteUser(id) {
    if(confirm('Remove this user?')) fetch(`/api/users/${id}`, { method: 'DELETE' }).then(() => loadUsers());
}


// --- 3. REPORTS & DASHBOARD LOGIC ---
function loadReports() {
    fetch('/api/reports')
        .then(res => res.json())
        .then(data => {
            // Update Dashboard Cards
            document.getElementById('dashRevenue').innerText = '$' + (parseFloat(data.revenue) || 0).toFixed(2);
            document.getElementById('dashOrders').innerText = data.total_orders || 0;

            // Update Tables (Both Dashboard and Report Page use the same data structure)
            const rows = data.recent_history.map(o => `
                <tr>
                    <td>#${o.id}</td>
                    <td>${o.customer_name}</td>
                    <td>${new Date(o.created_at).toLocaleDateString()}</td>
                    <td class="fw-bold">$${parseFloat(o.total_amount).toFixed(2)}</td>
                </tr>
            `).join('');

            // Populate both tables if they exist on the DOM
            const dashTable = document.getElementById('dashboardRecentTable');
            const reportTable = document.getElementById('reportsTableBody');
            
            if(dashTable) dashTable.innerHTML = rows || '<tr><td colspan="4">No Data</td></tr>';
            if(reportTable) reportTable.innerHTML = rows || '<tr><td colspan="4">No Data</td></tr>';
        });
}

// --- 4. PDF GENERATION ---
function downloadPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.text("Sales Report", 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

    // Summary
    const rev = document.getElementById('dashRevenue').innerText;
    const count = document.getElementById('dashOrders').innerText;
    doc.text(`Total Revenue: ${rev} | Total Orders: ${count}`, 14, 40);

    // Table
    doc.autoTable({
        startY: 50,
        html: '#reportTableForPDF', // Targets the table ID in admin.html
        theme: 'grid',
        headStyles: { fillColor: [108, 93, 211] } // Purple color
    });

    doc.save('cafeteria_report.pdf');
}