const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./utils/MongooseUtil');

const app = express();
const PORT = process.env.PORT || 3000;

// middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// paths
const adminBuildPath = path.resolve(__dirname, '../client-admin/build');
const customerBuildPath = path.resolve(__dirname, '../client-customer/build');

// test api
app.get('/hello', (req, res) => {
  res.json({ message: 'Hello from server!' });
});

// apis
app.use('/api/admin', require('./api/admin.js'));
app.use('/api/customer', require('./api/customer.js'));

// =========================
// STATIC FILES
// =========================

// admin static
app.use('/admin', express.static(adminBuildPath));

// customer static
app.use(express.static(customerBuildPath));

// =========================
// REACT ROUTES
// =========================

// admin routes
app.get('/admin', (req, res) => {
  res.sendFile(path.join(adminBuildPath, 'index.html'));
});

app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(adminBuildPath, 'index.html'));
});

// customer routes
app.get('/', (req, res) => {
  res.sendFile(path.join(customerBuildPath, 'index.html'));
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/admin')) {
    return next();
  }

  res.sendFile(path.join(customerBuildPath, 'index.html'));
});

// start server only after MongoDB connected
connectDB()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server listening on ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Không thể khởi động server vì lỗi kết nối MongoDB');
    console.error(err.message);
    process.exit(1);
  });