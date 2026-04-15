import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginAdminComponent from './pages/LoginAdminComponent';
import DashboardComponent from './pages/DashboardComponent';
import ProductAdminComponent from './pages/ProductAdminComponent';
import CategoryAdminComponent from './pages/CategoryAdminComponent';
import CustomerAdminComponent from './pages/CustomerAdminComponent';
import OrderAdminComponent from './pages/OrderAdminComponent';
import StaffAdminComponent from './pages/StaffAdminComponent';
import VoucherAdminComponent from './pages/VoucherAdminComponent';

import './App.css';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('adminToken');
  return token ? children : <Navigate to="/login" replace />;
}

function App() {
  const token = localStorage.getItem('adminToken');

  return (
    <Routes>
      <Route path="/login" element={<LoginAdminComponent />} />

      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <DashboardComponent />
          </PrivateRoute>
        }
      />

      <Route
        path="/products"
        element={
          <PrivateRoute>
            <ProductAdminComponent />
          </PrivateRoute>
        }
      />

      <Route
        path="/categories"
        element={
          <PrivateRoute>
            <CategoryAdminComponent />
          </PrivateRoute>
        }
      />

      <Route
        path="/vouchers"
        element={
          <PrivateRoute>
            <VoucherAdminComponent />
          </PrivateRoute>
        }
      />

      <Route
        path="/customers"
        element={
          <PrivateRoute>
            <CustomerAdminComponent />
          </PrivateRoute>
        }
      />

      <Route
        path="/orders"
        element={
          <PrivateRoute>
            <OrderAdminComponent />
          </PrivateRoute>
        }
      />

      <Route
        path="/staffs"
        element={
          <PrivateRoute>
            <StaffAdminComponent />
          </PrivateRoute>
        }
      />

      <Route
        path="/"
        element={<Navigate to={token ? '/dashboard' : '/login'} replace />}
      />

      <Route
        path="*"
        element={<Navigate to={token ? '/dashboard' : '/login'} replace />}
      />
    </Routes>
  );
}

export default App;