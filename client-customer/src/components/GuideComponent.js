import React from 'react';
import { Link } from 'react-router-dom';
import MenuComponent from './MenuComponent';
import InformComponent from './InformComponent';
import { DELIVERY_TIME_SLOTS } from '../services/delivery';

const steps = [
  ['Chọn mẫu hoa yêu thích', 'Xem ảnh, thông tin và giá trên trang sản phẩm. Chọn số lượng rồi nhấn “Thêm vào giỏ hàng” hoặc “Mua ngay”.'],
  ['Kiểm tra giỏ hàng', 'Kiểm tra mẫu hoa, số lượng và thành tiền. Bạn có thể điều chỉnh số lượng hoặc bỏ sản phẩm trước khi nhấn “Mua hàng”.'],
  ['Áp dụng voucher nếu có', 'Nhập mã tại giỏ hàng và nhấn “Áp dụng”. Kiểm tra thông báo kết quả và số tiền giảm; nếu thay đổi giỏ hàng, hãy áp dụng lại mã trước khi tiếp tục.'],
  ['Nhập thông tin người nhận', 'Sau khi nhấn “Mua hàng” tại giỏ hàng, điền họ và tên, số điện thoại và địa chỉ nhận hàng. Kiểm tra kỹ thông tin để hoa được gửi đúng người, đúng địa chỉ.'],
  ['Chọn thời gian và gửi lời nhắn', `Trong mục “Thời gian & lời nhắn”, chọn ngày giao từ hôm nay trở đi và một khung giờ giao mong muốn: ${DELIVERY_TIME_SLOTS.map(slot => slot.replace('-', ' - ')).join(', ')}. Bạn có thể nhập “Lời nhắn thiệp” gửi người nhận và “Ghi chú cho shop” riêng cho việc chuẩn bị/giao hàng, chẳng hạn gọi trước khi giao.`],
  ['Chọn hình thức thanh toán', 'Chọn thanh toán khi nhận hàng (COD). Trang thanh toán cũng có chuyển khoản ngân hàng và MoMo, nhưng hai lựa chọn này hiện ở chế độ demo. Với lựa chọn demo, giao diện yêu cầu xác nhận đã hoàn tất thanh toán demo trước khi đặt hàng.'],
  ['Kiểm tra lại toàn bộ thông tin', 'Đọc lại thông tin người nhận, ngày giao, khung giờ giao mong muốn, lời nhắn thiệp, ghi chú cho shop và phương thức thanh toán. Tại “Đơn hàng của bạn”, kiểm tra sản phẩm, số lượng, giảm giá voucher, phí vận chuyển và tổng cộng.'],
  ['Xác nhận đặt hàng', 'Nhấn “Xác nhận đặt hàng” và chờ xử lý. Khi đặt thành công, bạn sẽ được chuyển tới trang xác nhận đơn hàng. Nếu có thông báo lỗi, hãy kiểm tra và làm theo hướng dẫn trên màn hình.'],
  ['Theo dõi đơn hàng', 'Mở “Đơn hàng của tôi” bằng tài khoản đã đặt hàng để xem thông tin và trạng thái: Chờ xác nhận, Đã xác nhận, Đang chuẩn bị, Đang giao hàng, Hoàn thành hoặc Đã hủy.']
];

function GuideComponent() {
  return (
    <div>
      <MenuComponent />

      <main className="wf-guide">
        <header className="wf-guide-intro">
          <p className="wf-guide-eyebrow">WIND FLOWER · HƯỚNG DẪN</p>
          <h1>Hướng dẫn mua hàng</h1>
          <p className="wf-guide-lead">Mua hoa tại Wind Flower thật đơn giản.</p>
          <p>
            Chỉ cần lựa chọn mẫu hoa yêu thích, cung cấp thông tin người nhận,
            chọn ngày giao, khung giờ giao mong muốn và phương thức thanh toán. Trước khi xác nhận, bạn có thể kiểm tra
            lại toàn bộ thông tin đơn hàng để đảm bảo hoa được gửi đúng người và đúng yêu cầu.
          </p>
          <div className="wf-guide-actions">
            <Link className="wf-guide-primary" to="/">Chọn hoa ngay</Link>
            <Link to="/cart">Xem giỏ hàng</Link>
          </div>
        </header>

        <section className="wf-guide-before" aria-labelledby="guide-before-title">
          <h2 id="guide-before-title">Trước khi bắt đầu</h2>
          <p>Bạn cần đăng nhập để đặt hàng. Hãy chuẩn bị họ tên, số điện thoại và địa chỉ đầy đủ của người nhận.</p>
        </section>

        <section aria-labelledby="guide-steps-title">
          <div className="wf-guide-section-heading">
            <h2 id="guide-steps-title">Từ chọn hoa đến theo dõi đơn</h2>
            <p>9 bước để bạn dễ dàng kiểm tra từng thao tác.</p>
          </div>
          <ol className="wf-guide-steps">
            {steps.map(([title, description], index) => (
              <li className="wf-guide-step" key={title}>
                <span className="wf-guide-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <aside className="wf-guide-delivery" aria-labelledby="guide-delivery-title">
          <h2 id="guide-delivery-title">Bạn cần giao vào dịp cụ thể?</h2>
          <p>
            Wind Flower sẽ cố gắng giao trong khung giờ bạn chọn; đây là khung giờ giao
            mong muốn, không phải cam kết giao chính xác giờ. Nếu cần giao gấp hoặc có yêu cầu về thời gian,
            hãy liên hệ Wind Flower để hỏi thêm trước khi đặt hàng.
            Ghi chú trong đơn không đồng nghĩa với việc lịch giao đã được xác nhận.
          </p>
          <Link to="/lien-he">Liên hệ Wind Flower →</Link>
        </aside>

        <nav className="wf-guide-links" aria-label="Liên kết hỗ trợ mua hàng">
          <Link to="/my-orders">Đơn hàng của tôi →</Link>
          <Link to="/hinh-thuc-thanh-toan">Hướng dẫn thanh toán →</Link>
        </nav>
      </main>

      <InformComponent />
    </div>
  );
}

export default GuideComponent;
