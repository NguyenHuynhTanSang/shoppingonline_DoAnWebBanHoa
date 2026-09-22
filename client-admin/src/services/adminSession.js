export function clearAdminSession() {
  ['adminToken', 'token', 'admin', 'adminUser', 'adminRole'].forEach((key) => {
    localStorage.removeItem(key);
  });
}
