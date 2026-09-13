import React from 'react';
import { Link } from 'react-router-dom';
import MenuComponent from './MenuComponent';
import InformComponent from './InformComponent';


function ReturnPolicyComponent() {
  return (
    <div>
      <MenuComponent />
      <main className="wf-shipping">
        <header className="wf-shipping-hero">
          <p className="wf-shipping-eyebrow">WIND FLOWER · HỖ TRỢ ĐƠN HÀNG</p>
          <h1>Đổi trả, hoàn tiền &amp; thay đổi đơn</h1>
          <p>Nếu hoa bạn nhận không đúng với đơn hoặc có vấn đề khi nhận, hãy liên hệ Wind Flower để shop kiểm tra và hỗ trợ nhé.</p>
          <p>Hoa tươi được chuẩn bị theo từng đơn hàng. Phương án xử lý phụ thuộc tình trạng thực tế của hoa, đơn hàng và kết quả xác minh.</p>
          <Link to="/lien-he">Liên hệ Wind Flower →</Link>
        </header>
        <p className="wf-shipping-intro">Bạn có thể xem trạng thái hiện tại tại <Link to="/my-orders">Đơn hàng của tôi</Link> trước khi gửi yêu cầu.</p>
        <div className="wf-shipping-grid">
          <section aria-labelledby="returns-issues">
            <h2 id="returns-issues">01. Hoa giao sai, thiếu hoặc hư hỏng</h2>
            <p>Nếu nhận sai mẫu, thiếu sản phẩm hoặc hoa bị hư hỏng rõ ràng, vui lòng liên hệ Wind Flower sớm, cung cấp mã đơn nếu có và mô tả vấn đề.</p>
            <p>Bạn có thể được đề nghị cung cấp ảnh sản phẩm theo hướng dẫn của nhân viên để hỗ trợ xác minh. Wind Flower sẽ kiểm tra trường hợp cụ thể và hỗ trợ phương án phù hợp.</p>
          </section>
          <section aria-labelledby="returns-mind">
            <h2 id="returns-mind">02. Khi bạn thay đổi ý định</h2>
            <p>Do đặc thù hoa tươi được chuẩn bị theo từng đơn hàng, Wind Flower có thể không hỗ trợ đổi hoặc hủy khi đơn đã bước vào quá trình chuẩn bị.</p>
            <p>Nếu không còn muốn nhận hoa hoặc muốn đổi mẫu, hãy liên hệ shop sớm để kiểm tra khả năng hỗ trợ. Việc đổi ý không đồng nghĩa với việc được đổi trả vô điều kiện.</p>
          </section>
          <section aria-labelledby="returns-cancel">
            <h2 id="returns-cancel">03. Yêu cầu hủy đơn</h2>
            <p>Bạn có thể yêu cầu hủy khi đơn chưa bắt đầu chuẩn bị hoa.</p>
            <ul>
              <li><strong>Chờ xác nhận:</strong> có thể dùng nút “Hủy đơn” trong Đơn hàng của tôi.</li>
              <li><strong>Đã xác nhận:</strong> liên hệ Wind Flower để yêu cầu hủy trước khi shop bắt đầu chuẩn bị; website không cho tự hủy ở trạng thái này.</li>
              <li><strong>Đang chuẩn bị / Đang giao hàng:</strong> Wind Flower sẽ kiểm tra khả năng hỗ trợ dựa trên tình trạng thực tế, không tự động hủy.</li>
              <li><strong>Hoàn thành / Đã hủy:</strong> nếu còn vấn đề cần xử lý, vui lòng liên hệ nhân viên kiểm tra.</li>
            </ul>
            <p>Hủy đơn không đồng nghĩa với việc đã hoàn tiền.</p>
          </section>
          <section aria-labelledby="returns-change">
            <h2 id="returns-change">04. Thay đổi thông tin đơn</h2>
            <p>Bạn có thể yêu cầu thay đổi tên, số điện thoại người nhận, địa chỉ, ngày giao, khung giờ giao mong muốn, lời nhắn thiệp hoặc ghi chú trước khi đơn bắt đầu chuẩn bị hoặc giao.</p>
            <p>Website chưa có chức năng để khách tự sửa đơn. Vui lòng liên hệ Wind Flower; sau khi đơn bắt đầu chuẩn bị hoặc giao, shop sẽ kiểm tra khả năng điều chỉnh thực tế.</p>
            <p>Yêu cầu chỉ được thực hiện khi shop xác nhận có thể hỗ trợ.</p>
          </section>
          <section aria-labelledby="returns-refund">
            <h2 id="returns-refund">05. Xem xét hoàn tiền</h2>
            <p>Hoàn tiền cần nhân viên xác minh, không phải thao tác tự động. Phương án phụ thuộc kết quả kiểm tra và phương thức thanh toán thực tế; shop có thể cần thông tin liên quan để xác minh đơn.</p>
            <p>Checkout có thanh toán khi nhận hàng (COD). Chuyển khoản ngân hàng và MoMo trên website hiện là demo, chưa phải luồng thanh toán hoặc hoàn tiền trực tuyến thực tế.</p>
            <p className="wf-shipping-pending">Cần chủ shop xác nhận: thời hạn báo vấn đề, mức hoặc tỷ lệ hoàn tiền, bồi thường, điều kiện đổi hoa và thời gian xử lý hoàn tiền. Trang này chưa đưa ra cam kết cho các nội dung đó.</p>
          </section>
          <section aria-labelledby="returns-redelivery">
            <h2 id="returns-redelivery">06. Điều chỉnh thông tin và giao lại</h2>
            <p>Nếu số điện thoại, địa chỉ hoặc người nhận chưa chính xác, Wind Flower hỗ trợ điều chỉnh nếu còn khả năng xử lý.</p>
            <p>Nếu phải giao lại do thông tin sai hoặc không liên hệ được người nhận, có thể phát sinh phí giao lại 30.000đ. Nếu lỗi do Wind Flower, không thu thêm phí giao lại.</p>
            <p>Xem thêm <Link to="/chinh-sach-giao-hang">Chính sách giao hàng</Link>. Shop sẽ trao đổi phương án xử lý với người đặt.</p>
          </section>
          <section aria-labelledby="returns-support">
            <h2 id="returns-support">07. Cách yêu cầu hỗ trợ</h2>
            <p>Liên hệ qua hotline hoặc email trên trang Liên hệ, kèm mã đơn nếu có, mô tả sự cố hoặc thông tin cần thay đổi. Chỉ cung cấp thông tin cần thiết; không gửi mật khẩu, mã đăng nhập hoặc thông tin thẻ.</p>
            <p>Bạn cũng có thể đăng nhập và yêu cầu gặp nhân viên qua Wind Flower AI. Chỉ khi hệ thống thông báo ghi nhận yêu cầu thành công thì yêu cầu mới được tạo. Hình ảnh, nếu cần, được cung cấp theo hướng dẫn của nhân viên; chat hiện hỗ trợ tin nhắn văn bản.</p>
            <Link className="wf-shipping-contact" to="/lien-he">Liên hệ Wind Flower →</Link>
          </section>
          <section aria-labelledby="returns-ai">
            <h2 id="returns-ai">08. Vai trò của Wind Flower AI</h2>
            <p>AI hỗ trợ giải thích thông tin đã xác nhận, tra cứu đơn của bạn ở chế độ chỉ đọc và ghi nhận yêu cầu để chuyển nhân viên.</p>
            <p>AI không tự hủy đơn, hoàn tiền, sửa đơn, sửa thanh toán hoặc thay đổi thông tin giao hàng. Những yêu cầu này cần nhân viên kiểm tra.</p>
          </section>
        </div>
      </main>
      <InformComponent />
    </div>
  );
}

export default ReturnPolicyComponent;
