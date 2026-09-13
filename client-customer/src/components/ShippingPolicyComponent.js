import React from 'react';
import { Link } from 'react-router-dom';
import MenuComponent from './MenuComponent';
import InformComponent from './InformComponent';
import { DELIVERY_TIME_SLOTS } from '../services/delivery';

function ShippingPolicyComponent() {
  return (
    <div>
      <MenuComponent />
      <main className="wf-shipping">
        <header className="wf-shipping-hero">
          <p className="wf-shipping-eyebrow">WIND FLOWER · THÔNG TIN GIAO HOA</p>
          <h1>Chính sách giao hàng</h1>
          <p>Wind Flower luôn cố gắng chuẩn bị và giao hoa theo thông tin mà khách hàng đã cung cấp khi đặt hàng.</p>
          <p>Để việc giao hoa diễn ra thuận lợi, bạn vui lòng kiểm tra kỹ người nhận, số điện thoại, địa chỉ, ngày giao và khung giờ mong muốn trước khi xác nhận đơn hàng.</p>
          <Link to="/lien-he">Liên hệ Wind Flower →</Link>
        </header>

        <p className="wf-shipping-intro">Các mục “Đang áp dụng trên website” mô tả thông tin hiện có khi đặt hàng. “Chính sách shop đã xác nhận” là hướng dẫn phục vụ của Wind Flower. Với mục “Cần xác nhận với Wind Flower”, vui lòng liên hệ shop để kiểm tra trường hợp cụ thể.</p>

        <div className="wf-shipping-grid">
          <section aria-labelledby="shipping-date">
            <span className="wf-shipping-label">Đang áp dụng trên website</span>
            <h2 id="shipping-date">01. Ngày giao hoa</h2>
            <p>Bạn chọn ngày giao tại trang thanh toán. Website cho phép chọn hôm nay hoặc một ngày sau đó, không nhận ngày trong quá khứ.</p>
            <p>Ngày bạn chọn là thông tin để shop xử lý đơn theo khả năng phục vụ thực tế và tình trạng đơn hàng.</p>
            <p>Chính sách của shop: có thể hỗ trợ giao trong ngày với đơn đặt trước 15:00 (giờ Việt Nam); từ 15:00, ngày giao sớm nhất là ngày tiếp theo. Khả năng phục vụ cần được shop xác nhận, không đồng nghĩa với cam kết giao trong ngày.</p>
            <p className="wf-shipping-pending">Bộ chọn ngày trên website hiện chưa tự áp dụng mốc 15:00. Vui lòng chọn ngày phù hợp với chính sách trên hoặc liên hệ shop để được hướng dẫn.</p>
          </section>

          <section aria-labelledby="shipping-slots">
            <span className="wf-shipping-label">Đang áp dụng trên website</span>
            <h2 id="shipping-slots">02. Khung giờ giao mong muốn</h2>
            <ul className="wf-shipping-slots">
              {DELIVERY_TIME_SLOTS.map(slot => <li key={slot}>{slot.replace('-', ' – ')}</li>)}
            </ul>
            <p>Wind Flower sẽ cố gắng giao trong khung giờ bạn chọn. Đây là khoảng thời gian mong muốn, không phải giờ giao cam kết.</p>
            <p>Thời gian thực tế có thể chịu ảnh hưởng bởi việc chuẩn bị hoa, địa chỉ người nhận và điều kiện giao hàng.</p>
          </section>

          <section aria-labelledby="shipping-processing">
            <span className="wf-shipping-label wf-shipping-label-pending">Cần xác nhận với Wind Flower</span>
            <h2 id="shipping-processing">03. Thời gian xử lý và giao hàng</h2>
            <p>Hiện chưa có thông tin xác nhận về thời lượng chuẩn bị hoặc thời gian giao tối đa. Nếu đơn cần giao vào một dịp cụ thể, hãy liên hệ shop để kiểm tra khả năng hỗ trợ.</p>
            <p>Bạn có thể xem trạng thái Chờ xác nhận, Đã xác nhận, Đang chuẩn bị, Đang giao hàng, Hoàn thành hoặc Đã hủy tại <Link to="/my-orders">Đơn hàng của tôi</Link>. Trạng thái đơn không phải giờ đến dự kiến.</p>
          </section>

          <section aria-labelledby="shipping-fee">
            <span className="wf-shipping-label">Đang áp dụng trên website</span>
            <h2 id="shipping-fee">04. Phí giao hàng</h2>
            <dl className="wf-shipping-fees">
              <div><dt>Tiền sản phẩm dưới 1.500.000đ</dt><dd>30.000đ</dd></div>
              <div><dt>Tiền sản phẩm từ 1.500.000đ</dt><dd>Miễn phí giao hàng</dd></div>
            </dl>
            <p>Mức tiền xét phí là tổng tiền sản phẩm sau giảm giá sản phẩm và trước khi trừ voucher, chưa gồm phí giao hàng.</p>
            <p>Hãy kiểm tra dòng “Phí vận chuyển” và “Tổng cộng” tại checkout trước khi đặt hàng. Cách tính hiện tại không dựa trên khoảng cách; mức phí hiển thị không xác nhận địa chỉ nằm trong phạm vi phục vụ.</p>
          </section>

          <section aria-labelledby="shipping-area">
            <span className="wf-shipping-label">Chính sách shop đã xác nhận</span>
            <h2 id="shipping-area">05. Phạm vi giao hàng</h2>
            <p>Phạm vi phục vụ chính của Wind Flower là TP.HCM. Với địa chỉ ngoài phạm vi này, vui lòng hỏi shop về khả năng hỗ trợ.</p>
            <p>Vui lòng <Link to="/lien-he">liên hệ shop</Link> để kiểm tra địa chỉ cần giao trước khi đặt hàng.</p>
          </section>

          <section aria-labelledby="shipping-recipient">
            <span className="wf-shipping-label">Đang áp dụng trên website</span>
            <h2 id="shipping-recipient">06. Thông tin người nhận</h2>
            <p>Vui lòng kiểm tra tên người nhận, số điện thoại, địa chỉ đầy đủ, ngày giao và khung giờ mong muốn. Thông tin sai hoặc thiếu có thể ảnh hưởng đến việc giao hoa.</p>
            <p>“Lời nhắn thiệp” là nội dung gửi người nhận. “Ghi chú cho shop” dành cho yêu cầu chuẩn bị hoặc giao hàng, chẳng hạn gọi trước khi giao; hai nội dung được lưu riêng.</p>
          </section>

          <section aria-labelledby="shipping-absent">
            <span className="wf-shipping-label">Chính sách shop đã xác nhận</span>
            <h2 id="shipping-absent">07. Người nhận không có mặt</h2>
            <p>Nếu không liên hệ được người nhận, Wind Flower sẽ liên hệ người đặt để thống nhất cách xử lý. Shop không tự để hoa trước cửa hoặc giao cho bên thứ ba khi chưa được đồng ý.</p>
            <p>Nếu phải giao lại do thông tin sai hoặc không liên hệ được người nhận, có thể phát sinh phí giao lại 30.000đ. Nếu lỗi do Wind Flower, không thu thêm phí giao lại.</p>
          </section>

          <section aria-labelledby="shipping-incident">
            <span className="wf-shipping-label wf-shipping-label-pending">Cần xác nhận với Wind Flower</span>
            <h2 id="shipping-incident">08. Khi giao hàng gặp sự cố</h2>
            <p>Nếu đơn hàng gặp vấn đề trong quá trình giao, vui lòng liên hệ Wind Flower và cung cấp mã đơn để được kiểm tra, hỗ trợ.</p>
            <p>Phương án xử lý cần được shop xác nhận cho trường hợp cụ thể.</p>
          </section>

          <section aria-labelledby="shipping-changes">
            <span className="wf-shipping-label wf-shipping-label-pending">Cần xác nhận với Wind Flower</span>
            <h2 id="shipping-changes">09. Thay đổi thông tin giao hàng</h2>
            <p>Website hiện chưa có chức năng để khách tự sửa thông tin giao hàng sau khi đặt đơn.</p>
            <p>Bạn có thể yêu cầu thay đổi người nhận, địa chỉ, ngày giao, khung giờ giao mong muốn, lời nhắn thiệp hoặc ghi chú trước khi đơn bắt đầu chuẩn bị hoặc giao. Sau giai đoạn đó, việc thay đổi phụ thuộc khả năng xử lý thực tế. Vui lòng liên hệ Wind Flower; việc gửi yêu cầu không có nghĩa thay đổi đã được chấp nhận.</p>
          </section>

          <section aria-labelledby="shipping-support">
            <span className="wf-shipping-label">Kênh liên hệ hiện có</span>
            <h2 id="shipping-support">10. Hỗ trợ từ Wind Flower</h2>
            <p>Bạn có thể xem hotline và email tại trang Liên hệ. Hãy chuẩn bị mã đơn nếu đã đặt hàng để shop thuận tiện kiểm tra.</p>
            <Link className="wf-shipping-contact" to="/lien-he">Liên hệ Wind Flower →</Link>
          </section>
        </div>
      </main>
      <InformComponent />
    </div>
  );
}

export default ShippingPolicyComponent;
