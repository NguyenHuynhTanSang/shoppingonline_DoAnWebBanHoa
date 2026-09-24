import { render, screen } from '@testing-library/react';
import App from './App';

// Keep this smoke focused on real router matching, without page API/socket effects.
jest.mock('./components/AIChatComponent', () => () => <h1>AIChatComponent</h1>);
jest.mock('./components/MainComponent', () => () => <h1>MainComponent</h1>);
jest.mock('./components/CartComponent', () => () => <h1>CartComponent</h1>);
jest.mock('./components/LoginComponent', () => () => <h1>LoginComponent</h1>);
jest.mock('./components/ProductDetailComponent', () => () => <h1>ProductDetailComponent</h1>);
jest.mock('./components/RegisterComponent', () => () => <h1>RegisterComponent</h1>);
jest.mock('./components/ForgotPasswordComponent', () => () => <h1>ForgotPasswordComponent</h1>);
jest.mock('./components/ResetPasswordComponent', () => () => <h1>ResetPasswordComponent</h1>);
jest.mock('./components/CategoryPageComponent', () => () => <h1>CategoryPageComponent</h1>);
jest.mock('./components/SearchPageComponent', () => () => <h1>SearchPageComponent</h1>);
jest.mock('./components/CheckoutComponent', () => () => <h1>CheckoutComponent</h1>);
jest.mock('./components/OrderSuccessComponent', () => () => <h1>OrderSuccessComponent</h1>);
jest.mock('./components/MyOrdersComponent', () => () => <h1>MyOrdersComponent</h1>);
jest.mock('./components/AboutComponent', () => () => <h1>AboutComponent</h1>);
jest.mock('./components/NewsComponent', () => () => <h1>NewsComponent</h1>);
jest.mock('./components/GuideComponent', () => () => <h1>GuideComponent</h1>);
jest.mock('./components/PaymentPolicyComponent', () => () => <h1>PaymentPolicyComponent</h1>);
jest.mock('./components/ContactComponent', () => () => <h1>ContactComponent</h1>);
jest.mock('./components/ShippingPolicyComponent', () => () => <h1>ShippingPolicyComponent</h1>);
jest.mock('./components/ReturnPolicyComponent', () => () => <h1>ReturnPolicyComponent</h1>);
jest.mock('./components/NotFoundComponent', () => () => <h1>NotFoundComponent</h1>);

afterEach(() => window.history.replaceState({}, '', '/'));

test.each([['/', 'MainComponent'], ['/unknown-smoke-route', 'NotFoundComponent']])('customer route %s renders its page', (path, heading) => {
  window.history.replaceState({}, '', path);
  render(<App />);
  expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'AIChatComponent' })).toBeInTheDocument();
});
