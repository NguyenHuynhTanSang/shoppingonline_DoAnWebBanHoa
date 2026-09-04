# Project: Wind Flower

## Mục tiêu
Đây là website bán hoa cũ đang được cải thiện từng bước.
Không được làm mất các chức năng đang hoạt động.

## Công nghệ
- Frontend khách hàng: React
- Frontend admin: React
- Backend: Node.js + Express
- Database: MongoDB Atlas / Mongoose
- Xác thực: JWT
- Gọi API: Axios
- Deploy: Render

## Cấu trúc
- client-customer: giao diện khách hàng
- client-admin: giao diện admin/staff
- server: backend API và xử lý dữ liệu

## Quy tắc cho AI
- Không xóa chức năng cũ nếu chưa được yêu cầu.
- Không sửa các file không liên quan.
- Ưu tiên thay đổi nhỏ và an toàn.
- Phải đọc code hiện tại trước khi suy đoán.
- Không tự tạo API, model hoặc field không tồn tại.
- Không sửa schema MongoDB nếu chưa giải thích ảnh hưởng.
- Không tự ý thêm dependency nếu chưa cần thiết.
- Không tự ý nâng cấp toàn bộ package.
- Không được để lộ secret, password, JWT secret hoặc nội dung file .env.
- Không commit file .env.
- Sau khi sửa code phải báo rõ file nào đã thay đổi.
- Nếu có test/build thì phải chạy kiểm tra sau khi sửa.

## Quy trình làm việc
Trước khi sửa:
1. Đọc các file liên quan.
2. Giải thích nguyên nhân hoặc mục tiêu.
3. Liệt kê file cần sửa.
4. Nêu rủi ro có thể xảy ra.

Sau khi sửa:
1. Chạy test hoặc build nếu có.
2. Báo file đã thay đổi.
3. Giải thích thay đổi.
4. Nêu vấn đề còn tồn tại.
