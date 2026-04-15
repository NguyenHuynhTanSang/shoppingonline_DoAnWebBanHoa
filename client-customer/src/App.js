import './App.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainComponent from './components/MainComponent';
import CartComponent from './components/CartComponent';
import LoginComponent from './components/LoginComponent';
import ProductDetailComponent from './components/ProductDetailComponent';
import RegisterComponent from './components/RegisterComponent';
import ForgotPasswordComponent from './components/ForgotPasswordComponent';
import ResetPasswordComponent from './components/ResetPasswordComponent';
import CategoryPageComponent from './components/CategoryPageComponent';
import SearchPageComponent from './components/SearchPageComponent';
import CheckoutComponent from './components/CheckoutComponent';
import OrderSuccessComponent from './components/OrderSuccessComponent';
import MyOrdersComponent from './components/MyOrdersComponent';
import AboutComponent from './components/AboutComponent';
import NewsComponent from './components/NewsComponent';
import GuideComponent from './components/GuideComponent';
import PaymentPolicyComponent from './components/PaymentPolicyComponent';
import ContactComponent from './components/ContactComponent';
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainComponent />} />
        <Route path="/cart" element={<CartComponent />} />
        <Route path="/checkout" element={<CheckoutComponent />} />
        <Route path="/order-success" element={<OrderSuccessComponent />} />
        <Route path="/login" element={<LoginComponent />} />
        <Route path="/register" element={<RegisterComponent />} />
        <Route path="/forgot-password" element={<ForgotPasswordComponent />} />
        <Route path="/reset-password" element={<ResetPasswordComponent />} />
        <Route path="/product/:id" element={<ProductDetailComponent />} />
        <Route path="/category/:slug" element={<CategoryPageComponent />} />
        <Route path="/target/:slug" element={<CategoryPageComponent />} />
        <Route path="/search" element={<SearchPageComponent />} />
        <Route path="/my-orders" element={<MyOrdersComponent />} />
        <Route path="/gioi-thieu" element={<AboutComponent />} />
        <Route path="/tin-tuc" element={<NewsComponent />} />
        <Route path="/huong-dan-mua-hang" element={<GuideComponent />} />
        <Route path="/hinh-thuc-thanh-toan" element={<PaymentPolicyComponent />} />
        <Route path="/lien-he" element={<ContactComponent />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;