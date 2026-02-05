const socket = io();
const ordersContainer = document.getElementById('kitchen-orders');
const notifySound = document.getElementById('notifySound');

// 1. Load Existing Orders on Page Load
document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/orders')
        .then(res => res.json())
        .then(orders => {
            orders.forEach(order => renderOrderCard(order));
        });
});

// 2. Listen for NEW Orders (Real-Time!)
socket.on('new_order', (order) => {
    // Play sound
    notifySound.play().catch(e => console.log("Audio play blocked by browser"));
    
    // Render the new card
    renderOrderCard(order);
});

// 3. Listen for Status Updates (Optional: if multiple kitchen screens exist)
socket.on('order_status_updated', (data) => {
    const card = document.getElementById(`order-${data.id}`);
    if (card) {
        if (data.status === 'completed') {
            card.remove(); // Remove from screen
        } else {
            updateCardStyle(card, data.status);
        }
    }
});

// --- HELPER FUNCTIONS ---

function renderOrderCard(order) {
    // Build the HTML for the Items list
    let itemsHtml = '';
    order.items.forEach(item => {
        itemsHtml += `<li>${item.quantity}x <strong>${item.name}</strong></li>`;
    });

    const col = document.createElement('div');
    col.className = 'col-md-4 col-lg-3 mb-4';
    col.id = `order-${order.id}`;

    col.innerHTML = `
        <div class="card order-card shadow status-${order.status}">
            <div class="card-header d-flex justify-content-between align-items-center">
                <strong>#${order.id} - ${order.customer_name}</strong>
                <span class="badge bg-secondary">${new Date(order.created_at || Date.now()).toLocaleTimeString()}</span>
            </div>
            <div class="card-body">
                <ul class="list-unstyled mb-3">
                    ${itemsHtml}
                </ul>
                <hr>
                <div class="d-grid gap-2">
                    ${order.status === 'pending' 
                        ? `<button class="btn btn-primary btn-sm" onclick="updateStatus(${order.id}, 'preparing')">Start Cooking</button>` 
                        : ''}
                    
                    <button class="btn btn-success btn-sm" onclick="updateStatus(${order.id}, 'completed')">Mark Ready</button>
                </div>
            </div>
        </div>
    `;

    // Add to the START of the list
    ordersContainer.prepend(col);
}

function updateStatus(id, status) {
    fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
    // The Socket event 'order_status_updated' will handle the UI update
}

function updateCardStyle(cardElement, status) {
    const card = cardElement.querySelector('.card');
    card.className = `card order-card shadow status-${status}`;
    
    // Refresh buttons (Simple way: reload page or replace HTML, but let's just reload for simplicity in this demo)
    // In a real app, we would manipulate the DOM to hide the "Start Cooking" button.
    window.location.reload(); 
}

// 4. Load History (Last 50 completed)
function loadHistory() {
    fetch('/api/orders/history')
        .then(res => res.json())
        .then(orders => {
            const tbody = document.getElementById('history-table');
            tbody.innerHTML = '';

            orders.forEach(order => {
                const date = new Date(order.created_at).toLocaleTimeString();
                const row = `
                    <tr>
                        <td>${order.id}</td>
                        <td>${date}</td>
                        <td>${order.customer_name}</td>
                        <td><small>${order.items_summary}</small></td>
                        <td><span class="badge bg-success">Completed</span></td>
                    </tr>
                `;
                tbody.innerHTML += row;
            });
        });
}