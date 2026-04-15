import HeaderComponent from './HeaderComponent';
import SidebarComponent from './SidebarComponent';

function LayoutComponent({ children }) {
  return (
    <div className="admin-layout">
      <SidebarComponent />
      <div className="admin-main">
        <HeaderComponent />
        <div className="admin-content">
          {children}
        </div>
      </div>
    </div>
  );
}

export default LayoutComponent;