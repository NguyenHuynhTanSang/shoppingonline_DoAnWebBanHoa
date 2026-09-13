import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import API, { API_BASE } from '../services/api';
const laterStatus = (previous, next) => ({ pending: 0, in_progress: 1, resolved: 2 }[previous] > { pending: 0, in_progress: 1, resolved: 2 }[next] ? previous : next);

export default function HumanSupportChat({ requestId, onResolved, tokenKey = 'customerToken' }) {
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('pending');
  const [connection, setConnection] = useState('Đang kết nối…');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const socketRef = useRef(null);
  const retry = useRef(null);
  const busy = useRef(false);
  const resolvedCallback = useRef(onResolved);
  resolvedCallback.current = onResolved;
  const notified = useRef(null);
  const statusOwner = useRef(requestId);
  useEffect(() => {
    if (status !== 'resolved' || statusOwner.current !== requestId) return;
    setDraft(''); retry.current = null;
    socketRef.current?.disconnect();
    if (notified.current !== requestId) {
      notified.current = requestId;
      resolvedCallback.current?.(requestId);
    }
  }, [status, requestId]);
  const merge = rows => setMessages(previous => [...new Map([...previous, ...rows].map(row => [String(row._id), row])).values()].sort((a, b) => a.sequence - b.sequence));
  useEffect(() => {
    let alive = true;
    statusOwner.current = requestId;
    setMessages([]); setStatus('pending'); setReady(false); setError(''); setDraft(''); retry.current = null;
    const socket = io(API_BASE || window.location.origin, {
      auth: callback => callback({ token: localStorage.getItem(tokenKey) || '' }), reconnectionDelayMax: 5000
    });
    socketRef.current = socket;
    let polling = false;
    let closed = false;
    const refreshStatus = async () => {
      if (polling || closed) return;
      polling = true;
      try {
        const response = await API.get(`/support-chat/${requestId}/status`, { timeout: 10000 });
        if (alive) {
          closed = response.data.request.status === 'resolved';
          setStatus(previous => laterStatus(previous, response.data.request.status));
        }
      } catch { /* Keep the last confirmed state; reconnect/poll will retry. */ }
      finally { polling = false; }
    };
    const timer = setInterval(refreshStatus, 10000);
    window.addEventListener('focus', refreshStatus);
    socket.on('connect', () => {
      setConnection('Đang tải lịch sử…'); setReady(false);
      socket.timeout(10000).emit('support:join', { supportRequestId: requestId }, async (timeout, result) => {
        if (!alive) return;
        if (timeout || !result?.ok) { setError('Không thể truy cập phiên hỗ trợ.'); return; }
        try {
          const response = await API.get(`/support-chat/${requestId}/messages`);
          if (!alive) return;
          merge(response.data.messages); setHasMore(response.data.hasMore);
          setStatus(previous => laterStatus(previous, response.data.request.status)); setReady(true); setConnection('Đã kết nối'); setError('');
        } catch { if (alive) setError('Không tải được lịch sử. Hãy kết nối lại.'); }
      });
    });
    socket.on('support:message:new', data => { if (data.supportRequestId === requestId) merge([data.message]); });
    socket.on('support:status', data => { if (alive && data.id === requestId) {
      closed = data.status === 'resolved';
      setStatus(previous => laterStatus(previous, data.status));
    } });
    socket.on('disconnect', () => { setReady(false); setConnection('Mất kết nối. Đang kết nối lại…'); });
    socket.on('connect_error', () => { setReady(false); setConnection('Chưa kết nối. Kiểm tra đăng nhập hoặc thử kết nối lại.'); });
    socket.on('support:error', () => { setReady(false); setError('Bạn không còn quyền truy cập phiên này.'); });
    return () => { alive = false; clearInterval(timer); window.removeEventListener('focus', refreshStatus); socket.disconnect(); socketRef.current = null; };
  }, [requestId, tokenKey]);
  async function older() {
    try {
      const response = await API.get(`/support-chat/${requestId}/messages`, { params: { before: messages[0]?.sequence } });
      merge(response.data.messages); setHasMore(response.data.hasMore);
    } catch { setError('Không tải được tin nhắn cũ.'); }
  }
  function send(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !ready || !socketRef.current?.connected || status !== 'in_progress' || busy.current) return;
    if (!retry.current || retry.current.message !== text) {
      try {
        const id = window.crypto.randomUUID ? window.crypto.randomUUID() : Array.from(window.crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join('');
        retry.current = { message: text, clientMessageId: id };
      } catch { setError('Trình duyệt chưa hỗ trợ gửi tin an toàn. Vui lòng dùng HTTPS hoặc trình duyệt mới hơn.'); return; }
    }
    busy.current = true; setSending(true); setError('');
    socketRef.current.timeout(10000).emit('support:message', { supportRequestId: requestId, ...retry.current }, (timeout, result) => {
      busy.current = false; setSending(false);
      if (timeout || !result?.ok) {
        setError(result?.code === 'SESSION_CLOSED' ? 'Phiên không còn nhận tin nhắn.' : 'Chưa xác nhận gửi thành công. Có thể thử gửi lại cùng nội dung.');
        if (result?.code === 'SESSION_CLOSED') setReady(false);
        return;
      }
      merge([result.message]); retry.current = null; setDraft('');
    });
  }
  return <section aria-label="Trò chuyện với nhân viên" style={{ padding: 12, overflowY: 'auto', minHeight: 0 }}>
    <h3>{status === 'resolved' ? 'Phiên hỗ trợ đã kết thúc.' : status === 'pending' ? 'Đang chờ nhân viên Wind Flower tiếp nhận.' : 'Nhân viên Wind Flower đang hỗ trợ'}</h3>
    <p role="status">{status === 'resolved' ? 'Lịch sử hỗ trợ chỉ đọc.' : connection}</p>{error && <p role="alert">{error}</p>}
    {!ready && status !== 'resolved' && <button onClick={() => { socketRef.current?.disconnect(); socketRef.current?.connect(); }}>Kết nối lại</button>}
    {hasMore && <button onClick={older}>Tin nhắn cũ hơn</button>}
    <div role="log" aria-live="polite">{messages.map(item => <div key={item._id} style={{ margin: '10px 0', padding: 8, background: '#f5f5f5', overflowWrap: 'anywhere' }}>
      <strong>{item.senderType === 'customer' ? 'Khách hàng' : 'Nhân viên Wind Flower'}</strong>
      <p style={{ whiteSpace: 'pre-wrap' }}>{item.message}</p><small>{new Date(item.createdAt).toLocaleString('vi-VN')}</small>
    </div>)}</div>
    <form onSubmit={send} style={{ display: 'flex', gap: 8 }}>
      <input aria-label="Tin nhắn hỗ trợ" maxLength={2000} value={draft} onChange={event => setDraft(event.target.value)}
        disabled={!ready || sending || status !== 'in_progress'} style={{ minWidth: 0, flex: 1, padding: 10 }}
        onKeyDown={event => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault(); }} />
      <button disabled={!ready || sending || !draft.trim() || status !== 'in_progress'}>Gửi</button>
    </form>
  </section>;
}
