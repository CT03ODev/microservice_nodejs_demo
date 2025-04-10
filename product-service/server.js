require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3002; // Cổng cho Product Service

// Khởi tạo Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
    console.error("Lỗi: SUPABASE_URL hoặc SUPABASE_ANON_KEY chưa được cấu hình trong .env");
    process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

// --- API Endpoints ---

// Lấy tất cả sản phẩm
app.get('/products', async (req, res) => {
    const { data, error } = await supabase
        .from('products')
        .select('*');

    if (error) {
        console.error('Lỗi lấy danh sách sản phẩm:', error);
        return res.status(500).json({ error: 'Lỗi server nội bộ' });
    }
    res.json(data);
});

// Lấy sản phẩm theo ID
app.get('/products/:id', async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
         if (error.code === 'PGRST116') {
             return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
        }
        console.error(`Lỗi lấy sản phẩm ${id}:`, error);
        return res.status(500).json({ error: 'Lỗi server nội bộ' });
    }
     if (!data) {
         return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }
    res.json(data);
});

// Tạo sản phẩm mới
app.post('/products', async (req, res) => {
    const { name, description, price, stock } = req.body;

    if (!name || price === undefined || price === null) {
        return res.status(400).json({ error: 'Tên và giá là bắt buộc' });
    }
     if (isNaN(price) || Number(price) < 0) {
         return res.status(400).json({ error: 'Giá phải là một số không âm' });
     }
     if (stock !== undefined && (isNaN(stock) || Number(stock) < 0)) {
         return res.status(400).json({ error: 'Số lượng tồn kho (stock) phải là một số không âm' });
     }

    const { data, error } = await supabase
        .from('products')
        .insert([{ name, description, price: Number(price), stock: stock !== undefined ? Number(stock) : 0 }]) // Ép kiểu và đặt giá trị mặc định nếu cần
        .select()
        .single();

    if (error) {
        console.error('Lỗi tạo sản phẩm:', error);
        return res.status(500).json({ error: 'Lỗi server nội bộ khi tạo sản phẩm' });
    }

    res.status(201).json(data);
});

// Cập nhật sản phẩm
app.put('/products/:id', async (req, res) => {
    const { id } = req.params;
    const { name, description, price, stock } = req.body;

    const updates = {};
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (price !== undefined) {
         if (isNaN(price) || Number(price) < 0) {
             return res.status(400).json({ error: 'Giá phải là một số không âm' });
         }
         updates.price = Number(price);
    }
     if (stock !== undefined) {
         if (isNaN(stock) || Number(stock) < 0) {
             return res.status(400).json({ error: 'Số lượng tồn kho (stock) phải là một số không âm' });
         }
         updates.stock = Number(stock);
     }


    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'Không có thông tin nào được cung cấp để cập nhật' });
    }

    const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

     if (error) {
         if (error.code === 'PGRST116' || error.message.includes('exactly one row')) {
            return res.status(404).json({ message: 'Không tìm thấy sản phẩm để cập nhật' });
        }
        console.error(`Lỗi cập nhật sản phẩm ${id}:`, error);
        return res.status(500).json({ error: 'Lỗi server nội bộ khi cập nhật sản phẩm' });
    }
     if (!data) {
         return res.status(404).json({ message: 'Không tìm thấy sản phẩm sau khi cập nhật' });
    }

    res.json(data);
});

// Xóa sản phẩm
app.delete('/products/:id', async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)
        .select()
        .single(); // Mong đợi xóa 1

     if (error) {
        console.error(`Lỗi xóa sản phẩm ${id}:`, error);
        return res.status(500).json({ error: 'Lỗi server nội bộ khi xóa sản phẩm' });
    }
     if (!data) {
         return res.status(404).json({ message: 'Không tìm thấy sản phẩm để xóa' });
    }

    res.status(200).json({ message: 'Sản phẩm đã được xóa thành công', deletedProduct: data });
    // res.status(204).send();
});

// Khởi động server
app.listen(PORT, () => {
    console.log(`🚀 Product Service đang chạy trên cổng ${PORT}`);
    console.log(`✅ Kết nối tới Supabase URL: ${supabaseUrl ? supabaseUrl.substring(0, 20) + '...' : 'Chưa cấu hình'}`);
});