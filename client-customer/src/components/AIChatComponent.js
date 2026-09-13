import React, {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';

import { Link } from 'react-router-dom';
import API from '../services/api';
import getImageSrc from '../services/productImage';
import HumanSupportChat from './HumanSupportChat';

const memoryKey = 'wf-ai-conversation';

function accountScope() {
  const token =
    localStorage.getItem(
      'customerToken'
    );

  if (!token) {
    return 'guest';
  }

  try {
    const payload = JSON.parse(
      atob(
        token
          .split('.')[1]
          .replace(/-/g, '+')
          .replace(/_/g, '/')
      )
    );

    return `customer:${payload.sub}`;
  } catch {
    return 'invalid-account';
  }
}

function readConversation() {
  try {
    const saved =
      JSON.parse(
        sessionStorage.getItem(
          memoryKey
        )
      );

    return (
      saved?.scope ===
        accountScope() &&
      /^[a-f\d]{64}$/.test(
        saved.id
      )
    )
      ? saved.id
      : undefined;
  } catch {
    return undefined;
  }
}

export default function AIChatComponent() {
  const [
    open,
    setOpen
  ] = useState(false);

  const [
    draft,
    setDraft
  ] = useState('');

  const [
    messages,
    setMessages
  ] = useState([]);

  const [
    pending,
    setPending
  ] = useState(false);

  const [
    error,
    setError
  ] = useState('');

  const [
    supportContext,
    setSupportContext
  ] = useState(undefined);

  const [
    humanRequest,
    setHumanRequest
  ] = useState(null);

  const [
    checkingHuman,
    setCheckingHuman
  ] = useState(false);

  const input =
    useRef(null);

  const launcher =
    useRef(null);

  const log =
    useRef(null);

  const request =
    useRef(null);

  const ended =
    useRef(
      new Set()
    );

  const returnToAI =
    useCallback(
      id => {
        setHumanRequest(null);
        setSupportContext(undefined);
        setDraft('');
        setError('');

        if (
          !ended.current.has(id)
        ) {
          if (
            sessionStorage.getItem(
              'wf-ai-ended-support'
            ) !== id
          ) {
            sessionStorage.removeItem(
              memoryKey
            );
          }

          sessionStorage.setItem(
            'wf-ai-ended-support',
            id
          );

          ended.current.add(id);

          setMessages(
            previous => [
              ...previous,
              {
                role: 'system',
                reply:
                  'Nhân viên Wind Flower đã kết thúc phiên hỗ trợ. Bạn có thể tiếp tục trò chuyện với Wind Flower AI.'
              }
            ]
          );
        }
      },
      []
    );

  useEffect(() => {
    if (
      !open ||
      !localStorage.getItem(
        'customerToken'
      )
    ) {
      return;
    }

    let alive = true;

    setCheckingHuman(true);

    API.get(
      '/support-chat/current'
    )
      .then(response => {
        const current =
          response.data.request;

        if (!alive) {
          return;
        }

        if (
          current?.status ===
          'resolved'
        ) {
          returnToAI(
            current.id
          );
        } else {
          setHumanRequest(
            current?.id ||
            null
          );
        }
      })
      .catch(() => {
        if (alive) {
          setError(
            'Chưa kiểm tra được phiên hỗ trợ. Vui lòng mở lại chat.'
          );
        }
      })
      .finally(() => {
        if (alive) {
          setCheckingHuman(
            false
          );
        }
      });

    return () => {
      alive = false;
    };
  }, [
    open,
    returnToAI
  ]);

  useEffect(
    () => () =>
      request.current?.abort(),
    []
  );

  useEffect(() => {
    if (open) {
      input.current?.focus();
    }
  }, [
    open,
    pending
  ]);

  useEffect(() => {
    if (log.current) {
      log.current.scrollTop =
        log.current.scrollHeight;
    }
  }, [
    messages,
    pending,
    error,
    open
  ]);

  function close() {
    setOpen(false);

    launcher.current?.focus();
  }

  async function send(event) {
    event.preventDefault();

    const message =
      draft.trim();

    if (
      !message ||
      request.current ||
      checkingHuman ||
      humanRequest
    ) {
      return;
    }

    const controller =
      new AbortController();

    request.current =
      controller;

    setPending(true);
    setError('');
    setDraft('');

    setMessages(
      previous => [
        ...previous,
        {
          role: 'customer',
          reply: message
        }
      ]
    );

    try {
      const scope =
        accountScope();

      const conversationId =
        readConversation();

      const { data } =
        await API.post(
          '/ai/chat',
          {
            message,
            memory: true,

            ...(conversationId
              ? {
                  conversationId
                }
              : {}),

            ...(supportContext
              ? {
                  supportContext
                }
              : {})
          },
          {
            timeout: 30000,
            signal:
              controller.signal
          }
        );

      if (
        scope !==
        accountScope()
      ) {
        sessionStorage.removeItem(
          memoryKey
        );

        setMessages([]);
        setSupportContext(
          undefined
        );

        return;
      }

      if (
        !data ||
        typeof data.reply !==
          'string' ||
        !data.reply.trim() ||
        !Array.isArray(
          data.products
        )
      ) {
        throw new Error(
          'Invalid response'
        );
      }

      const products =
        data.products
          .filter(
            product =>
              product &&
              typeof product.id ===
                'string' &&
              /^[a-f\d]{24}$/i.test(
                product.id
              ) &&
              typeof product.name ===
                'string' &&
              product.name.trim() &&
              Number.isFinite(
                product.price
              ) &&
              product.price >= 0
          )
          .slice(0, 4);

      setSupportContext(
        typeof data.supportContext ===
          'string'
          ? data.supportContext
          : undefined
      );

      if (
        typeof data.conversationId ===
          'string' &&
        /^[a-f\d]{64}$/.test(
          data.conversationId
        )
      ) {
        sessionStorage.setItem(
          memoryKey,
          JSON.stringify({
            id:
              data.conversationId,
            scope
          })
        );
      }

      if (
        data.supportRequestId ||
        data.supportContext
      ) {
        sessionStorage.removeItem(
          memoryKey
        );
      }

      if (
        data.supportRequestId
      ) {
        setHumanRequest(
          data.supportRequestId
        );
      }

      setMessages(
        previous => [
          ...previous,
          {
            role: 'assistant',
            reply: data.reply,
            products
          }
        ]
      );
    } catch (failure) {
      if (
        !controller.signal.aborted
      ) {
        setDraft(message);

        setError(
          failure.response?.status ===
            401
            ? 'Vui lòng đăng nhập để tra cứu đơn hoặc tạo yêu cầu hỗ trợ.'

            : failure.response?.status ===
                403
              ? 'Tài khoản không được phép tra cứu đơn hàng. Vui lòng kiểm tra tài khoản đăng nhập.'

              : failure.response?.data
                    ?.type ===
                  'human_handoff'
                ? 'Chưa thể tạo yêu cầu hỗ trợ. Vui lòng thử gửi lại sau.'

                : 'Chưa thể kết nối với Wind Flower AI. Vui lòng thử gửi lại sau.'
        );
      }
    } finally {
      request.current = null;

      if (
        !controller.signal.aborted
      ) {
        setPending(false);
      }
    }
  }

  return (
    <div className="wf-ai-space">
      <button
        ref={launcher}
        type="button"
        className="wf-ai-launcher"
        aria-expanded={open}
        aria-controls="wf-ai-panel"
        onClick={() =>
          open
            ? close()
            : setOpen(true)
        }
      >
        {open
          ? 'Thu nhỏ AI'
          : 'Chat với AI'}
      </button>

      {open && (
        <section
          id="wf-ai-panel"
          className="wf-ai-panel"
          aria-label="Wind Flower AI"
          onKeyDown={event => {
            if (
              event.key ===
              'Escape'
            ) {
              close();
            }
          }}
        >
          <header className="wf-ai-header">
            <strong>
              Wind Flower AI
            </strong>

            {!humanRequest && (
              <button
                type="button"
                className="wf-ai-new-chat-button"
                disabled={
                  pending ||
                  checkingHuman
                }
                onClick={() => {
                  sessionStorage.removeItem(
                    memoryKey
                  );

                  setMessages([]);
                  setSupportContext(
                    undefined
                  );
                  setDraft('');
                  setError('');
                }}
              >
                Trò chuyện mới
              </button>
            )}

            <button
              type="button"
              className="wf-ai-close-button"
              onClick={close}
              aria-label="Đóng chat"
            >
              ×
            </button>
          </header>

          {humanRequest ? (
            <HumanSupportChat
              requestId={
                humanRequest
              }
              onResolved={
                returnToAI
              }
            />
          ) : (
            <>
              <div
                ref={log}
                className="wf-ai-log"
                role="log"
                aria-label="Tin nhắn"
                aria-live="polite"
              >
                {checkingHuman && (
                  <p
                    className="wf-ai-status"
                    role="status"
                  >
                    Đang kiểm tra phiên hỗ trợ…
                  </p>
                )}

                <p className="wf-ai-intro">
                  Bạn đang tìm hoa cho dịp nào? Hãy chia sẻ ngân sách và sở thích nhé.
                </p>

                {messages.map(
                  (
                    message,
                    index
                  ) => (
                    <div
                      key={index}
                      className={
                        `wf-ai-message wf-ai-${message.role}`
                      }
                    >
                      <span className="wf-ai-author">
                        {message.role ===
                        'customer'
                          ? 'Bạn'
                          : message.role ===
                              'system'
                            ? 'Hệ thống'
                            : 'Wind Flower AI'}
                      </span>

                      <p>
                        {message.reply}
                      </p>

                      {message.products?.map(
                        (
                          product,
                          productIndex
                        ) => (
                          <article
                            className="wf-ai-product"
                            key={
                              `${product.id}-${productIndex}`
                            }
                          >
                            {typeof product.image ===
                              'string' &&
                              product.image && (
                                <img
                                  src={getImageSrc(
                                    product.image
                                  )}
                                  alt={
                                    product.name
                                  }
                                  onError={event => {
                                    event.currentTarget.style.display =
                                      'none';
                                  }}
                                />
                              )}

                            <div className="wf-ai-product-info">
                              <strong>
                                {
                                  product.name
                                }
                              </strong>

                              <p>
                                {product.price.toLocaleString(
                                  'vi-VN'
                                )}{' '}
                                ₫
                              </p>

                              <Link
                                to={`/product/${product.id}`}
                                onClick={
                                  close
                                }
                              >
                                Xem sản phẩm
                              </Link>
                            </div>
                          </article>
                        )
                      )}
                    </div>
                  )
                )}

                {pending && (
                  <p
                    className="wf-ai-status"
                    role="status"
                  >
                    Wind Flower AI đang trả lời…
                  </p>
                )}

                {error && (
                  <p
                    className="wf-ai-error"
                    role="alert"
                  >
                    {error}
                  </p>
                )}
              </div>

              <form
                className="wf-ai-form"
                onSubmit={send}
              >
                {supportContext && (
                  <button
                    type="button"
                    className="wf-ai-stop-support-button"
                    disabled={
                      pending
                    }
                    onClick={() =>
                      setSupportContext(
                        undefined
                      )
                    }
                  >
                    Dừng yêu cầu
                  </button>
                )}

                <label
                  htmlFor="wf-ai-input"
                  className="wf-ai-label"
                >
                  Tin nhắn của bạn
                </label>

                <input
                  ref={input}
                  id="wf-ai-input"
                  value={draft}
                  onChange={event =>
                    setDraft(
                      event.target.value
                    )
                  }
                  placeholder="Nhập nhu cầu chọn hoa…"
                  maxLength={2000}
                  disabled={pending}
                  onKeyDown={event => {
                    if (
                      event.key ===
                        'Enter' &&
                      event.nativeEvent
                        .isComposing
                    ) {
                      event.preventDefault();
                    }
                  }}
                />

                <button
                  type="submit"
                  disabled={
                    pending ||
                    checkingHuman ||
                    !draft.trim()
                  }
                >
                  Gửi
                </button>
              </form>
            </>
          )}
        </section>
      )}
    </div>
  );
}