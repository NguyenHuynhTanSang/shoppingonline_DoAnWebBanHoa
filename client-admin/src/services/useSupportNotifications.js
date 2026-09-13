import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import API, { API_BASE } from './api';

export default function useSupportNotifications() {
  const [pending, setPending] = useState(null);
  const [notice, setNotice] = useState(null);
  useEffect(() => {
    if (!localStorage.getItem('adminToken')) return;
    let alive = true;
    let loading = false;
    let dirty = false;
    const seen = new Set();
    const controller = new AbortController();
    async function refresh() {
      if (!alive) return;
      if (loading) { dirty = true; return; }
      loading = true;
      try {
        const { data } = await API.get('/admin/support-requests', {
          params: { status: 'pending', page: 1 }, timeout: 10000, signal: controller.signal
        });
        if (alive && data.success && Number.isInteger(data.stats?.pending) && data.stats.pending >= 0) {
          setPending(data.stats.pending);
          window.dispatchEvent(new Event('wf:support-refresh'));
        }
      } catch { /* Preserve the last confirmed count; reconnect/focus/poll retries. */ }
      finally {
        loading = false;
        if (dirty && alive) { dirty = false; refresh(); }
      }
    }
    const socket = io(API_BASE || window.location.origin, {
      auth: callback => callback({ token: localStorage.getItem('adminToken') || '' }),
      reconnectionDelayMax: 5000
    });
    function created(data) {
      if (!alive || typeof data?.supportRequestId !== 'string' || data.status !== 'pending') return;
      if (!seen.has(data.supportRequestId)) {
        seen.add(data.supportRequestId);
        if (seen.size > 500) seen.delete(seen.values().next().value);
        setNotice({ id: data.supportRequestId });
      }
      refresh();
    }
    socket.on('connect', refresh);
    socket.on('support:new', created);
    socket.on('support:updated', refresh);
    window.addEventListener('focus', refresh);
    const timer = setInterval(refresh, 30000);
    refresh();
    return () => {
      alive = false; controller.abort(); clearInterval(timer);
      window.removeEventListener('focus', refresh);
      socket.off('connect', refresh); socket.off('support:new', created); socket.off('support:updated', refresh);
      socket.disconnect();
    };
  }, []);
  return { pending, notice, dismiss: () => setNotice(null) };
}
