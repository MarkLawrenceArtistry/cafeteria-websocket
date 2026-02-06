const socket = io();
const ordersContainer = document.getElementById('kitchen-orders');
const notifySound = document.getElementById('notifySound');

// 1. Load Existing Orders
document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/orders')
        .then(res => res.json())
        .then(orders => {
            // Clear container first to prevent duplicates
            ordersContainer.innerHTML = '';
            // Reverse order to show newest first
            orders.forEach(order => renderOrderCard(order));
        });
});

// 2. Listen for NEW Orders
socket.on('new_order', (order) => {
    notifySound.play().catch(e => console.log("Audio blocked"));
    renderOrderCard(order);
});

// 3. Listen for Status Updates
socket.on('order_status_updated', (data) => {
    const col = document.getElementById(`order-${data.id}`);
    if (col) {
        if (data.status === 'completed') {
            // Animate removal
            col.style.transition = 'all 0.5s';
            col.style.opacity = '0';
            col.style.transform = 'scale(0.9)';
            setTimeout(() => col.remove(), 500);
        } else {
            // Update UI for "Preparing"
            updateCardStyle(col, data.status, data.id);
        }
    }
});

// --- HELPER FUNCTIONS ---

function renderOrderCard(order) {
    let itemsHtml = '';
    order.items.forEach(item => {
        itemsHtml += `
            <div class="ticket-item">
                <span class="fw-bold">${item.quantity}x ${item.name}</span>
            </div>`;
    });

    const col = document.createElement('div');
    col.className = 'col-md-4 col-lg-3';
    col.id = `order-${order.id}`;

    // Determine initial state
    const isPending = order.status === 'pending';
    const statusClass = isPending ? 'status-pending' : 'status-preparing';
    const btnText = isPending ? 'Start Cooking' : 'Mark Ready';
    const btnClass = isPending ? 'btn-primary' : 'btn-success';
    const nextStatus = isPending ? 'preparing' : 'completed';

    col.innerHTML = `
        <div class="ticket-card ${statusClass} h-100">
            <div class="ticket-header">
                <span class="fw-bold">#${order.id}</span>
                <small>${new Date(order.created_at || Date.now()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</small>
            </div>
            <div class="ticket-body">
                <div class="mb-2 text-muted small"><i class="bi bi-person"></i> ${order.customer_name}</div>
                ${itemsHtml}
            </div>
            <div class="ticket-footer mt-auto">
                <button id="btn-${order.id}" class="btn ${btnClass} btn-action" 
                    onclick="updateStatus(${order.id}, '${nextStatus}')">
                    ${btnText}
                </button>
            </div>
        </div>
    `;

    ordersContainer.prepend(col);
}

function updateStatus(id, status) {
    // Send update to server
    fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
    // The socket listener above will handle the visual update
}

function updateCardStyle(colElement, status, id) {
    // 1. Find the inner card
    const card = colElement.querySelector('.ticket-card');
    
    // 2. Remove old status class, add new one
    card.classList.remove('status-pending');
    card.classList.add('status-preparing');

    // 3. Update the Button
    const btn = colElement.querySelector('button');
    btn.className = 'btn btn-success btn-action';
    btn.innerText = 'Mark Ready';
    
    // 4. Update the onclick attribute to point to 'completed' next
    btn.setAttribute('onclick', `updateStatus(${id}, 'completed')`);
}

// History Logic
function loadHistory() {
    fetch('/api/orders/history')
        .then(res => res.json())
        .then(orders => {
            const tbody = document.getElementById('history-table');
            tbody.innerHTML = '';
            orders.forEach(order => {
                const row = `
                    <tr>
                        <td>${order.id}</td>
                        <td>${new Date(order.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td>
                        <td>${order.customer_name}</td>
                        <td><small>${order.items_summary}</small></td>
                        <td><span class="badge bg-success">Completed</span></td>
                    </tr>
                `;
                tbody.innerHTML += row;
            });
        });
}