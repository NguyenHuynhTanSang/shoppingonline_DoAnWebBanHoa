import React from 'react';
import MenuComponent from './MenuComponent';
import InformComponent from './InformComponent';

function NewsComponent() {
  const newsList = [
    {
      id: 1,
      title: 'Tại sao chúng ta tặng hoa?',
      desc: 'Hoa không chỉ là món quà đẹp mà còn mang ý nghĩa tinh thần, thể hiện sự trân trọng, yêu thương và lời chúc tốt đẹp.'
    },
    {
      id: 2,
      title: 'Cách giữ hoa tươi lâu hơn',
      desc: 'Một số mẹo đơn giản như thay nước thường xuyên, cắt gốc chéo và tránh ánh nắng trực tiếp sẽ giúp hoa tươi lâu hơn.'
    },
    {
      id: 3,
      title: 'Cách chọn hoa phù hợp cho từng dịp',
      desc: 'Mỗi dịp như sinh nhật, khai trương, chúc mừng hay kỷ niệm đều phù hợp với những kiểu hoa và màu sắc khác nhau.'
    }
  ];

  return (
    <div>
      <MenuComponent />

      <div className="container" style={{ padding: '40px 0' }}>
        <div className="info-page-box">
          <h1>Tin tức</h1>
          <p>
            Cập nhật các bài viết, mẹo chăm sóc hoa và những thông tin hữu ích liên quan
            đến việc chọn hoa, bảo quản hoa và ý nghĩa của từng loại hoa.
          </p>

          <div className="news-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginTop: '24px' }}>
            {newsList.map((item) => (
              <div
                key={item.id}
                style={{
                  background: '#fff',
                  borderRadius: '14px',
                  padding: '20px',
                  boxShadow: '0 6px 18px rgba(0,0,0,0.08)'
                }}
              >
                <h3 style={{ marginBottom: '12px' }}>{item.title}</h3>
                <p style={{ lineHeight: '1.7' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <InformComponent />
    </div>
  );
}

export default NewsComponent;