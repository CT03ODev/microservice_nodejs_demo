require('dotenv').config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const morgan = require('morgan'); // Import morgan

const app = express();

// Lấy cấu hình từ .env
const PORT = process.env.PORT || 3000;
const CUSTOMER_SERVICE_URL = process.env.CUSTOMER_SERVICE_URL;
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL;
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL;

// Kiểm tra cấu hình URL
if (!CUSTOMER_SERVICE_URL || !PRODUCT_SERVICE_URL || !ORDER_SERVICE_URL) {
    console.error("Lỗi: Vui lòng cấu hình đầy đủ *_SERVICE_URL trong file .env của api-gateway");
    process.exit(1);
}

// Sử dụng morgan để log request (với format 'dev' cho gọn)
app.use(morgan('dev'));

// Middleware để parse JSON (nếu gateway cần xử lý body trước khi proxy)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// --- Định tuyến (Routing) và Proxy ---

// Proxy requests đến Customer Service
// Tất cả request đến /api/customers/* sẽ được chuyển đến Customer Service
app.use('/api/customers', createProxyMiddleware({
    target: CUSTOMER_SERVICE_URL,
    changeOrigin: true, // Cần thiết cho virtual hosted sites và CORS
    pathRewrite: {
        '^/api/customers': '/customers', // Xóa '/api/customers' khỏi path trước khi gửi đi
                                         // ví dụ: /api/customers/123 -> /customers/123
    },
    onProxyReq: (proxyReq, req, res) => {
        // Bạn có thể thay đổi request header ở đây nếu cần
        console.log(`[GW -> CustomerSvc] Forwarding request: ${req.method} ${req.path}`);
    },
    onError: (err, req, res) => {
        console.error('Proxy error:', err);
         res.status(500).send('Proxy error occurred');
    }
}));

// Proxy requests đến Product Service
app.use('/api/products', createProxyMiddleware({
    target: PRODUCT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
        '^/api/products': '/products', // /api/products/abc -> /products/abc
    },
     onProxyReq: (proxyReq, req, res) => {
        console.log(`[GW -> ProductSvc] Forwarding request: ${req.method} ${req.path}`);
    },
    onError: (err, req, res) => {
        console.error('Proxy error:', err);
         res.status(500).send('Proxy error occurred');
    }
}));

// Proxy requests đến Order Service
app.use('/api/orders', createProxyMiddleware({
    target: ORDER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
        '^/api/orders': '/orders', // /api/orders/xyz -> /orders/xyz
    },
    onProxyReq: (proxyReq, req, res) => {
        console.log(`[GW -> OrderSvc] Forwarding request: ${req.method} ${req.path}`);
     },
     onError: (err, req, res) => {
         console.error('Proxy error:', err);
         res.status(500).send('Proxy error occurred');
     }
}));

// Route mặc định cho các path không khớp
app.use('/', (req, res) => {
    res.status(404).json({ message: 'Endpoint không tồn tại trên API Gateway' });
});


// Khởi động API Gateway
app.listen(PORT, () => {
    console.log(` K̴i̴t̴t̴y̴ API Gateway đang lắng nghe trên cổng ${PORT}`);
    console.log(` перенаправлення запитів до:`);
    console.log(`  -> API Service: http://localhost:${PORT}`);
    console.log(`  -> Customer Service: ${CUSTOMER_SERVICE_URL}`);
    console.log(`  -> Product Service:  ${PRODUCT_SERVICE_URL}`);
    console.log(`  -> Order Service:    ${ORDER_SERVICE_URL}`);
});