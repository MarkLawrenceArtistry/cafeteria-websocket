const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db'); // Import database connection

const app = express();
const server = http.createServer(app); // Create HTTP server
const io = socketIo(server); // Attach Socket.io to the server

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // We will put HTML files in a 'public' folder later

// Basic Route to check if server is running
app.get('/', (req, res) => {
    res.send('Cafeteria WebSocket Server is Running!');
});

// WebSocket Connection Logic (We will expand this later)
io.on('connection', (socket) => {
    console.log('A user connected: ' + socket.id);

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});








// --- API ROUTES FOR PRODUCTS ---

// PRODUCTS
// 1. GET ALL PRODUCTS
app.get('/api/products', (req, res) => {
    const sql = "SELECT * FROM products";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// 2. ADD NEW PRODUCT
app.post('/api/products', (req, res) => {
    // Added stock_quantity to destructuring
    const { name, price, category, image_url, stock_quantity } = req.body;
    
    const sql = "INSERT INTO products (name, price, category, image_url, stock_quantity) VALUES (?, ?, ?, ?, ?)";
    // Default to 0 if stock not provided
    const stock = stock_quantity || 0; 
    
    db.query(sql, [name, price, category, image_url, stock], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ message: 'Product added!', id: result.insertId });
    });
});

// 3. DELETE PRODUCT
app.delete('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const sql = "DELETE FROM products WHERE id = ?";
    db.query(sql, [id], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ message: 'Product deleted!' });
    });
});

// ORDERS
app.post('/api/orders', (req, res) => {
    const { customer_name, items, total_amount } = req.body;

    // 1. Start Transaction (Ensures all or nothing)
    db.beginTransaction((err) => {
        if (err) return res.status(500).json(err);

        // 2. Check Stock for ALL items first
        // We create a promise for each item check
        const checkStockPromises = items.map(item => {
            return new Promise((resolve, reject) => {
                db.query("SELECT stock_quantity FROM products WHERE id = ?", [item.id], (err, results) => {
                    if (err) return reject(err);
                    if (results[0].stock_quantity < item.quantity) {
                        reject(`Not enough stock for Product ID ${item.id}`);
                    } else {
                        resolve();
                    }
                });
            });
        });

        Promise.all(checkStockPromises)
            .then(() => {
                // 3. Stock is good! Insert Order
                const orderSql = "INSERT INTO orders (customer_name, total_amount, status) VALUES (?, ?, 'pending')";
                db.query(orderSql, [customer_name, total_amount], (err, result) => {
                    if (err) {
                        return db.rollback(() => res.status(500).json(err));
                    }
                    const orderId = result.insertId;

                    // 4. Insert Order Items AND Deduct Stock
                    const orderItemsData = [];
                    const updateStockPromises = [];

                    items.forEach(item => {
                        orderItemsData.push([orderId, item.id, item.quantity, item.price]);
                        
                        // Deduct Query
                        const updateSql = "UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?";
                        updateStockPromises.push(new Promise((resolve, reject) => {
                            db.query(updateSql, [item.quantity, item.id], (err) => {
                                if (err) reject(err); else resolve();
                            });
                        }));
                    });

                    const itemsSql = "INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ?";
                    db.query(itemsSql, [orderItemsData], (err) => {
                        if (err) return db.rollback(() => res.status(500).json(err));

                        // Execute all stock deductions
                        Promise.all(updateStockPromises)
                            .then(() => {
                                // 5. COMMIT TRANSACTION
                                db.commit((err) => {
                                    if (err) return db.rollback(() => res.status(500).json(err));

                                    // Notify Kitchen
                                    const newOrderData = {
                                        id: orderId,
                                        customer_name,
                                        items,
                                        total_amount,
                                        status: 'pending',
                                        created_at: new Date()
                                    };
                                    io.emit('new_order', newOrderData);

                                    res.json({ message: 'Order placed!', orderId });
                                });
                            })
                            .catch(err => {
                                db.rollback(() => res.status(500).json({ error: 'Stock update failed' }));
                            });
                    });
                });
            })
            .catch(errorMsg => {
                // Stock check failed
                db.rollback(() => res.status(400).json({ error: errorMsg }));
            });
    });
});

// DASHBOARD
// --- API ROUTES FOR KITCHEN ---
app.get('/api/orders', (req, res) => {
    // This complex query joins 3 tables to get the order AND the food items names
    const sql = `
        SELECT o.id, o.customer_name, o.total_amount, o.status, o.created_at,
               p.name as product_name, oi.quantity
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        JOIN products p ON oi.product_id = p.id
        WHERE o.status != 'completed'
        ORDER BY o.created_at DESC
    `;

    db.query(sql, (err, results) => {
        if (err) return res.status(500).json(err);
        
        // The SQL returns one row per ITEM, not per ORDER. 
        // We must group them by Order ID in JavaScript.
        const ordersMap = {};
        
        results.forEach(row => {
            if (!ordersMap[row.id]) {
                ordersMap[row.id] = {
                    id: row.id,
                    customer_name: row.customer_name,
                    total_amount: row.total_amount,
                    status: row.status,
                    items: []
                };
            }
            ordersMap[row.id].items.push({
                name: row.product_name,
                quantity: row.quantity
            });
        });

        // Convert object back to array
        res.json(Object.values(ordersMap));
    });
});

// 2. Update Order Status
app.put('/api/orders/:id', (req, res) => {
    const { status } = req.body; // e.g., 'preparing' or 'completed'
    const { id } = req.params;

    const sql = "UPDATE orders SET status = ? WHERE id = ?";
    db.query(sql, [status, id], (err, result) => {
        if (err) return res.status(500).json(err);

        // Notify everyone that status changed
        io.emit('order_status_updated', { id, status });

        res.json({ message: 'Status updated' });
    });
});


// REPORTS
// --- API ROUTES FOR REPORTS ---
app.get('/api/reports', (req, res) => {
    const response = { revenue: 0, total_orders: 0, recent_history: [] };

    // 1. Get Totals (Completed orders only)
    const sqlTotals = "SELECT SUM(total_amount) as revenue, COUNT(*) as count FROM orders WHERE status = 'completed'";
    
    db.query(sqlTotals, (err, result) => {
        if (err) return res.status(500).json(err);
        
        response.revenue = result[0].revenue || 0;
        response.total_orders = result[0].count || 0;

        // 2. Get Recent Order History (Last 20)
        const sqlHistory = "SELECT * FROM orders WHERE status = 'completed' ORDER BY created_at DESC LIMIT 20";
        db.query(sqlHistory, (err, history) => {
            if (err) return res.status(500).json(err);
            
            response.recent_history = history;
            res.json(response);
        });
    });
});




// AUTH
// --- API ROUTE FOR LOGIN ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    // WARNING: In a real commercial app, passwords should be encrypted (hashed).
    // For this project, we are comparing plain text as per standard student project scope.
    const sql = "SELECT * FROM users WHERE username = ? AND password = ?";
    
    db.query(sql, [username, password], (err, results) => {
        if (err) return res.status(500).json(err);

        if (results.length > 0) {
            const user = results[0];
            // Send back the user info (excluding password)
            res.json({ 
                success: true, 
                user: { id: user.id, username: user.username, role: user.role } 
            });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    });
});




// --- API ROUTE FOR KITCHEN HISTORY ---
app.get('/api/orders/history', (req, res) => {
    // Get last 50 completed orders
    const sql = `
        SELECT o.id, o.customer_name, o.total_amount, o.created_at,
               GROUP_CONCAT(CONCAT(oi.quantity, 'x ', p.name) SEPARATOR ', ') as items_summary
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        JOIN products p ON oi.product_id = p.id
        WHERE o.status = 'completed'
        GROUP BY o.id
        ORDER BY o.created_at DESC
        LIMIT 50
    `;

    db.query(sql, (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});



// Start Server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

