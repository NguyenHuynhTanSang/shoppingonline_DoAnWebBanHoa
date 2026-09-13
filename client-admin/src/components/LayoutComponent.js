import HeaderComponent from './HeaderComponent';
import SidebarComponent from './SidebarComponent';
import { Link } from 'react-router-dom';
import useSupportNotifications from '../services/useSupportNotifications';

function LayoutComponent({ children }) {
  const { pending, notice, dismiss } = useSupportNotifications();
  return (
    <div className="admin-layout">
      <SidebarComponent pendingSupport={pending} />
      <div className="admin-main">
        <HeaderComponent />
        <div className="admin-content">
          {notice && <aside role="status" aria-label="Thông báo hỗ trợ" style={{ padding: 12, marginBottom: 12, background: '#fff3e6', borderRadius: 8, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <strong>Có yêu cầu hỗ trợ mới</strong>
            <Link to="/support-requests" onClick={dismiss}>Xem yêu cầu</Link>
            <button type="button" onClick={dismiss} aria-label="Đóng thông báo hỗ trợ">Đóng</button>
          </aside>}
          {children}
        </div>
      </div>
    </div>
  );
}

export default LayoutComponent;
