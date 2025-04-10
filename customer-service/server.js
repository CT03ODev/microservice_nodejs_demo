require('dotenv').config(); // Tải biến môi trường từ .env
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json()); // Middleware để parse JSON request body

const PORT = process.env.PORT || 3001; // Cổng cho Customer Service

// Khởi tạo Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
    console.error("Lỗi: SUPABASE_URL hoặc SUPABASE_ANON_KEY chưa được cấu hình trong .env");
    process.exit(1); // Thoát nếu thiếu cấu hình
}
const supabase = createClient(supabaseUrl, supabaseKey);

// --- API Endpoints ---

// Lấy tất cả khách hàng
app.get('/customers', async (req, res) => {
    const { data, error } = await supabase
        .from('customers')
        .select('*');

    if (error) {
        console.error('Lỗi lấy danh sách khách hàng:', error);
        return res.status(500).json({ error: 'Lỗi server nội bộ' });
    }
    res.json(data);
});

// Lấy khách hàng theo ID
app.get('/customers/:id', async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single(); // Chỉ trả về 1 bản ghi hoặc null

    if (error) {
        // Phân biệt lỗi không tìm thấy (PostgREST 406) và lỗi khác
        if (error.code === 'PGRST116') {
             return res.status(404).json({ message: 'Không tìm thấy khách hàng' });
        }
        console.error(`Lỗi lấy khách hàng ${id}:`, error);
        return res.status(500).json({ error: 'Lỗi server nội bộ' });
    }

    if (!data) {
         return res.status(404).json({ message: 'Không tìm thấy khách hàng' });
    }

    res.json(data);
});


// Tạo khách hàng mới
app.post('/customers', async (req, res) => {
    const { name, email, address } = req.body;

    if (!name || !email) {
        return res.status(400).json({ error: 'Tên và email là bắt buộc' });
    }

    const { data, error } = await supabase
        .from('customers')
        .insert([{ name, email, address }])
        .select() // Trả về bản ghi vừa tạo
        .single();

    if (error) {
        // Xử lý lỗi trùng email (nếu có constraint UNIQUE)
        if (error.code === '23505') { // Mã lỗi PostgreSQL cho unique violation
             return res.status(409).json({ error: 'Email đã tồn tại' });
        }
        console.error('Lỗi tạo khách hàng:', error);
        return res.status(500).json({ error: 'Lỗi server nội bộ khi tạo khách hàng' });
    }

    res.status(201).json(data);
});

// Cập nhật khách hàng
app.put('/customers/:id', async (req, res) => {
    const { id } = req.params;
    const { name, email, address } = req.body;

    // Kiểm tra xem có dữ liệu để cập nhật không
    const updates = {};
    if (name) updates.name = name;
    if (email) updates.email = email;
    if (address !== undefined) updates.address = address; // Cho phép cập nhật address thành null/rỗng

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'Không có thông tin nào được cung cấp để cập nhật' });
    }


    const { data, error } = await supabase
        .from('customers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        if (error.code === 'PGRST116' || error.message.includes('exactly one row')) { // Có thể Supabase trả về lỗi này nếu không tìm thấy bản ghi để update
            return res.status(404).json({ message: 'Không tìm thấy khách hàng để cập nhật' });
        }
        if (error.code === '23505') { // Trùng email
             return res.status(409).json({ error: 'Email đã tồn tại' });
        }
        console.error(`Lỗi cập nhật khách hàng ${id}:`, error);
        return res.status(500).json({ error: 'Lỗi server nội bộ khi cập nhật khách hàng' });
    }
     if (!data) { // Đảm bảo data có tồn tại sau khi update thành công (trường hợp hiếm)
         return res.status(404).json({ message: 'Không tìm thấy khách hàng sau khi cập nhật' });
    }

    res.json(data);
});

// Xóa khách hàng
app.delete('/customers/:id', async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id)
        .select() // Trả về bản ghi đã xóa (hoặc [])
        .single(); // Mong đợi xóa 1 bản ghi

     if (error) {
         // Supabase v2 dường như không trả về lỗi cụ thể nếu không tìm thấy bản ghi để xóa,
         // thay vào đó data sẽ là null (hoặc tùy thuộc vào .select()).
         // Kiểm tra error chung trước.
        console.error(`Lỗi xóa khách hàng ${id}:`, error);
        return res.status(500).json({ error: 'Lỗi server nội bộ khi xóa khách hàng' });
    }

     // Kiểm tra xem có bản ghi nào được xóa không
     // Nếu data là null hoặc mảng rỗng (tùy version/cách gọi) nghĩa là không tìm thấy
    if (!data) {
         return res.status(404).json({ message: 'Không tìm thấy khách hàng để xóa' });
    }


    res.status(200).json({ message: 'Khách hàng đã được xóa thành công', deletedCustomer: data });
    // Hoặc chỉ cần trả về status 204 No Content nếu không cần trả về data
    // res.status(204).send();
});


// Khởi động server
app.listen(PORT, () => {
    console.log(`🚀 Customer Service đang chạy trên cổng ${PORT}`);
    console.log(`✅ Kết nối tới Supabase URL: ${supabaseUrl ? supabaseUrl.substring(0, 20) + '...' : 'Chưa cấu hình'}`);
});