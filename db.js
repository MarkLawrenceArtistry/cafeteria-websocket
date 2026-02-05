const mysql = require('mysql2');

// Create the connection to the database
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',      // Default XAMPP user
    password: '',      // Default XAMPP password (leave empty if none)
    database: 'cafeteria_db'
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL Database (cafeteria_db)');
});

module.exports = db;