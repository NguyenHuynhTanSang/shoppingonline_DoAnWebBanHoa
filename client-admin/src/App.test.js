import { render, screen } from '@testing-library/react';
import App from './App';
import { MemoryRouter } from 'react-router-dom';

// Keep this smoke focused on real router matching, without page API/socket effects.
jest.mock('./pages/LoginAdminComponent', () => () => <h1>LoginAdminComponent</h1>);
jest.mock('./pages/DashboardComponent', () => () => <h1>DashboardComponent</h1>);
jest.mock('./pages/ProductAdminComponent', () => () => <h1>ProductAdminComponent</h1>);
jest.mock('./pages/CategoryAdminComponent', () => () => <h1>CategoryAdminComponent</h1>);
jest.mock('./pages/CustomerAdminComponent', () => () => <h1>CustomerAdminComponent</h1>);
jest.mock('./pages/OrderAdminComponent', () => () => <h1>OrderAdminComponent</h1>);
jest.mock('./pages/StaffAdminComponent', () => () => <h1>StaffAdminComponent</h1>);
jest.mock('./pages/VoucherAdminComponent', () => () => <h1>VoucherAdminComponent</h1>);
jest.mock('./pages/SupportQueueComponent', () => () => <h1>SupportQueueComponent</h1>);

beforeEach(() => localStorage.clear());

test.each(['/admin/', '/admin/dashboard'])('unauthenticated %s renders login under admin basename', async path => {
  render(<MemoryRouter basename="/admin" initialEntries={[path]}><App /></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: 'LoginAdminComponent' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'DashboardComponent' })).not.toBeInTheDocument();
});
