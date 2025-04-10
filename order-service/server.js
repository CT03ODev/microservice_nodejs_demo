require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3003; // Cổng cho Order Service

// Khởi tạo Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
    console.error("Lỗi: SUPABASE_URL hoặc SUPABASE_ANON_KEY chưa được cấu hình trong .env");
    process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

// --- API Endpoints ---

// Lấy tất cả đơn hàng
app.get('/orders', async (req, res) => {
    // Có thể thêm query param để lọc theo customer_id hoặc status
    // ví dụ: /orders?customerId=abc-123 hoặc /orders?status=pending
    const { customerId, status } = req.query;
    let query = supabase.from('orders').select('*');

    if (customerId) {
        query = query.eq('customer_id', customerId);
    }
    if (status) {
        query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Lỗi lấy danh sách đơn hàng:', error);
        return res.status(500).json({ error: 'Lỗi server nội bộ' });
    }
    res.json(data);
});

// Lấy đơn hàng theo ID
app.get('/orders/:id', async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single();

     if (error) {
         if (error.code === 'PGRST116') {
             return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
        }
        console.error(`Lỗi lấy đơn hàng ${id}:`, error);
        return res.status(500).json({ error: 'Lỗi server nội bộ' });
    }
     if (!data) {
         return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }
    res.json(data);
});

// Tạo đơn hàng mới
app.post('/orders', async (req, res) => {
    // Trong ví dụ đơn giản này, ta chỉ lưu thông tin cơ bản của đơn hàng.
    // Thực tế, bạn cần nhận danh sách sản phẩm (product_id, quantity),
    // gọi Product Service để kiểm tra tồn kho, tính tổng tiền,
    // và lưu vào bảng `order_items` nữa.
    const { customer_id, total_amount, status } = req.body;

    if (!customer_id || total_amount === undefined || total_amount === null) {
        return res.status(400).json({ error: 'customer_id và total_amount là bắt buộc' });
    }
     if (isNaN(total_amount) || Number(total_amount) < 0) {
         return res.status(400).json({ error: 'Tổng tiền (total_amount) phải là một số không âm' });
     }

    const newOrder = {
        customer_id,
        total_amount: Number(total_amount),
        status: status || 'pending' // Mặc định là 'pending' nếu không cung cấp
    };

    const { data, error } = await supabase
        .from('orders')
        .insert([newOrder])
        .select()
        .single();

    if (error) {
        console.error('Lỗi tạo đơn hàng:', error);
        // Có thể cần kiểm tra lỗi foreign key nếu customer_id không tồn tại (nếu có constraint)
        return res.status(500).json({ error: 'Lỗi server nội bộ khi tạo đơn hàng' });
    }

    res.status(201).json(data);
});

// Cập nhật trạng thái đơn hàng
app.patch('/orders/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
        return res.status(400).json({ error: 'Trạng thái (status) là bắt buộc' });
    }

    // Có thể thêm kiểm tra logic chuyển đổi trạng thái hợp lệ ở đây
    // (ví dụ: không thể chuyển từ 'shipped' về 'pending')

    const { data, error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

     if (error) {
         if (error.code === 'PGRST116' || error.message.includes('exactly one row')) {
            return res.status(404).json({ message: 'Không tìm thấy đơn hàng để cập nhật trạng thái' });
        }
        console.error(`Lỗi cập nhật trạng thái đơn hàng ${id}:`, error);
        return res.status(500).json({ error: 'Lỗi server nội bộ khi cập nhật trạng thái' });
    }
     if (!data) {
         return res.status(404).json({ message: 'Không tìm thấy đơn hàng sau khi cập nhật trạng thái' });
    }

    res.json(data);
});

// Khởi động server
app.listen(PORT, () => {
    console.log(`🚀 Order Service đang chạy trên cổng ${PORT}`);
    console.log(`✅ Kết nối tới Supabase URL: ${supabaseUrl ? supabaseUrl.substring(0, 20) + '...' : 'Chưa cấu hình'}`);
});