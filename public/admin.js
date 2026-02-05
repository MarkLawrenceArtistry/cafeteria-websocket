const socket = io();

// 1. When a new order is placed...
socket.on('new_order', () => {
    // A. Update the Sales Reports (Revenue goes up)
    loadReports();
    
    // B. Update the Menu List (Stock goes down)
    loadProducts();
    
    // Optional: Play a "Ka-ching!" sound or show a toast notification
    console.log("New Order Received! Dashboard Updated.");
});

// 2. When an order status changes (e.g., Kitchen marks as ready)...
socket.on('order_status_updated', () => {
    // We might want to refresh reports to show updated status
    loadReports(); 
});

// 1. Fetch and Display Products on Load
document.addEventListener('DOMContentLoaded', loadProducts);

function loadProducts() {
    fetch('/api/products')
        .then(response => response.json())
        .then(products => {
            const tableBody = document.getElementById('productTableBody');
            tableBody.innerHTML = ''; // Clear existing list

            products.forEach(product => {
                const row = `
                    <tr>
                        <td>${product.id}</td>
                        <td>${product.name}</td>
                        <td><span class="badge bg-secondary">${product.category}</span></td>
                        <td>${product.stock_quantity}</td> <!-- NEW FIELD -->
                        <td>$${product.price}</td>
                        <td>
                            <button class="btn btn-danger btn-sm" onclick="deleteProduct(${product.id})">Delete</button>
                        </td>
                    </tr>
                `;
                tableBody.innerHTML += row;
            });
        });
}

// 2. Add New Product
document.getElementById('addProductForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const name = document.getElementById('pName').value;
    const price = document.getElementById('pPrice').value;
    const category = document.getElementById('pCategory').value;
    const stock_quantity = document.getElementById('pStock').value;

    fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, price, category, stock_quantity, image_url: '' })
    })
    .then(response => response.json())
    .then(data => {
        alert('Product Added!');
        document.getElementById('addProductForm').reset();
        loadProducts(); // Refresh list
    });
});

// 3. Delete Product
function deleteProduct(id) {
    if(confirm('Are you sure you want to remove this item?')) {
        fetch(`/api/products/${id}`, { method: 'DELETE' })
            .then(res => res.json())
            .then(() => {
                loadProducts(); // Refresh list
            });
    }
}

// 4. Load Sales Reports
function loadReports() {
    fetch('/api/reports')
        .then(res => res.json())
        .then(data => {
            // 1. Convert string "10.50" to number 10.50
            const revenue = parseFloat(data.revenue);
            const orders = parseInt(data.total_orders);

            // 2. Safe check: if NaN (no sales yet), default to 0
            const finalRevenue = isNaN(revenue) ? 0 : revenue;
            const finalOrders = isNaN(orders) ? 0 : orders;

            // 3. Update UI
            document.getElementById('totalRevenue').innerText = '$' + finalRevenue.toFixed(2);
            document.getElementById('totalOrders').innerText = finalOrders;

            // Update Table
            const tbody = document.getElementById('reportsTableBody');
            tbody.innerHTML = '';
            
            // Check if recent_history exists before looping
            if (data.recent_history && data.recent_history.length > 0) {
                data.recent_history.forEach(order => {
                    const date = new Date(order.created_at).toLocaleString();
                    const row = `
                        <tr>
                            <td>${order.id}</td>
                            <td>${order.customer_name}</td>
                            <td>${date}</td>
                            <td>$${parseFloat(order.total_amount).toFixed(2)}</td>
                        </tr>
                    `;
                    tbody.innerHTML += row;
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center">No completed orders yet.</td></tr>';
            }
        })
        .catch(err => console.error("Error loading reports:", err));
}