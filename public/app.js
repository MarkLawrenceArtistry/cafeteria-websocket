const socket = io(); // Connect to WebSocket Server
let cart = [];
let products = [];

// 1. Load Products on Startup
document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/products')
        .then(res => res.json())
        .then(data => {
            products = data;
            renderProducts(products);
        });
});

// 2. Render Product Grid
function renderProducts(list) {
    const container = document.getElementById('product-list');
    container.innerHTML = '';
    
    list.forEach(prod => {
        // Disable click if stock is 0
        const isOutOfStock = prod.stock_quantity <= 0;
        const pointerEvent = isOutOfStock ? 'none' : 'auto';
        const opacity = isOutOfStock ? '0.5' : '1';
        const badge = isOutOfStock ? '<span class="badge bg-danger">Out of Stock</span>' : `<span class="badge bg-info">Stock: ${prod.stock_quantity}</span>`;

        const card = `
            <div class="col-md-4 col-lg-3">
                <div class="card product-card h-100" 
                     style="pointer-events: ${pointerEvent}; opacity: ${opacity}"
                     onclick="addToCart(${prod.id})">
                    <div class="card-body text-center">
                        <h5 class="card-title">${prod.name}</h5>
                        ${badge}
                        <p class="card-text text-muted">${prod.category}</p>
                        <h4 class="text-primary">$${prod.price}</h4>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += card;
    });
}

// 3. Add to Cart Logic
function addToCart(id) {
    const product = products.find(p => p.id === id);
    const existingItem = cart.find(item => item.id === id);

    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    updateCartUI();
}

// 4. Update Cart UI
function updateCartUI() {
    const cartList = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total');
    const countEl = document.getElementById('cart-count');
    const btn = document.getElementById('btn-checkout');

    cartList.innerHTML = '';
    let total = 0;
    let count = 0;

    cart.forEach((item, index) => {
        total += item.price * item.quantity;
        count += item.quantity;

        const li = `
            <li class="list-group-item d-flex justify-content-between lh-sm">
                <div>
                    <h6 class="my-0">${item.name}</h6>
                    <small class="text-muted">$${item.price} x ${item.quantity}</small>
                </div>
                <span class="text-muted">$${(item.price * item.quantity).toFixed(2)}</span>
                <button class="btn btn-sm btn-outline-danger ms-2" onclick="removeFromCart(${index})">x</button>
            </li>
        `;
        cartList.innerHTML += li;
    });

    totalEl.textContent = `$${total.toFixed(2)}`;
    countEl.textContent = count;
    btn.disabled = cart.length === 0;
}

function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartUI();
}

// 5. Checkout (Send Order to Server)
document.getElementById('btn-checkout').addEventListener('click', () => {
    const customerName = document.getElementById('customerName').value || 'Guest';
    const totalAmount = parseFloat(document.getElementById('cart-total').textContent.replace('$', ''));

    // Basic Validation
    if(cart.length === 0) return;

    const orderData = {
        customer_name: customerName,
        total_amount: totalAmount,
        items: cart
    };

    fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
    })
    .then(res => res.json())
    .then(response => {
        if (response.error) {
            alert('Error: ' + response.error); // Show stock error
        } else {
            // SUCCESS: Show Receipt
            showReceipt(response.orderId, customerName, totalAmount, cart);
            
            // Clear Cart
            cart = []; 
            updateCartUI();
            document.getElementById('customerName').value = '';
        }
    })
    .catch(err => alert('System Error'));
});

// 6. Function to Generate Receipt
function showReceipt(orderId, customer, total, items) {
    // Fill Details
    document.getElementById('receipt-details').innerHTML = `
        <p><strong>Order #:</strong> ${orderId}</p>
        <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
    `;
    
    document.getElementById('receipt-customer').innerText = customer;
    document.getElementById('receipt-total').innerText = '$' + total.toFixed(2);

    // Fill Items
    const tbody = document.getElementById('receipt-items');
    tbody.innerHTML = '';
    
    items.forEach(item => {
        tbody.innerHTML += `
            <tr>
                <td>${item.name}</td>
                <td class="text-end">${item.quantity}</td>
                <td class="text-end">$${(item.price * item.quantity).toFixed(2)}</td>
            </tr>
        `;
    });

    // Show Modal using Bootstrap API
    const receiptModal = new bootstrap.Modal(document.getElementById('receiptModal'));
    receiptModal.show();
}