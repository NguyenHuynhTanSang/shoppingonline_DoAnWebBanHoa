const nodemailer = require('nodemailer');
const MyConstants = require('./MyConstants');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: MyConstants.EMAIL_USER,
    pass: MyConstants.EMAIL_PASS
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000
});

function wrapHTML(title, bodyHTML) {
  return `
  <div style="
    font-family: Arial, Helvetica, sans-serif;
    background: #f6f7fb;
    padding: 24px;
    color: #111827;
  ">
    <div style="
      max-width: 640px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 14px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.06);
      overflow: hidden;
    ">
      <div style="
        padding: 18px 22px;
        background: linear-gradient(135deg, #111827 0%, #334155 100%);
        color: #ffffff;
      ">
        <div style="font-size: 14px; opacity: 0.9;">WIND FLOWER</div>
        <div style="font-size: 20px; font-weight: 700; margin-top: 4px;">${title}</div>
      </div>

      <div style="padding: 22px;">
        ${bodyHTML}
        <div style="margin-top: 18px; font-size: 12px; color: #6b7280;">
          Nếu bạn không thực hiện yêu cầu này, bạn có thể bỏ qua email.
        </div>
      </div>

      <div style="
        padding: 14px 22px;
        background: #f9fafb;
        border-top: 1px solid #eef2f7;
        font-size: 12px;
        color: #6b7280;
      ">
        © ${new Date().getFullYear()} WIND FLOWER • Automated Email
      </div>
    </div>
  </div>`;
}

function badge(label, value) {
  return `
  <div style="
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    background: #f9fafb;
    margin-top: 10px;
  ">
    <div style="font-size: 13px; color:#374151; font-weight: 600;">${label}</div>
    <div style="
      font-size: 14px;
      font-weight: 800;
      color:#111827;
      background: #fff;
      padding: 8px 12px;
      border-radius: 10px;
      border: 1px dashed #cbd5e1;
      letter-spacing: 0.3px;
      word-break: break-all;
    ">${value}</div>
  </div>`;
}

async function sendMailSafe(options) {
  try {
    const result = await Promise.race([
      transporter.sendMail(options),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Email send timeout')), 15000)
      )
    ]);

    console.log('EMAIL SENT OK:', result?.messageId || 'no-message-id');
    return true;
  } catch (err) {
    console.error('EMAIL SEND ERROR:', err?.message || err);
    return false;
  }
}

const EmailUtil = {
  async sendActivation(email, id, token) {
    try {
      const text =
        `Thanks for signing up.\n\n` +
        `Please use the following information to activate your account:\n` +
        `- id: ${id}\n` +
        `- token: ${token}\n`;

      const html = wrapHTML(
        'Signup Verification',
        `
        <div style="font-size: 15px; line-height: 1.6;">
          <div style="font-size: 16px; font-weight: 700; margin-bottom: 6px;">
            Xin chào,
          </div>
          <div style="color:#374151;">
            Cảm ơn bạn đã đăng ký. Để <b>kích hoạt tài khoản</b>, vui lòng nhập chính xác các thông tin dưới đây:
          </div>

          ${badge('ID (Quan trọng)', id)}
          ${badge('TOKEN (Quan trọng)', token)}

          <div style="
            margin-top: 14px;
            padding: 12px 14px;
            border-left: 4px solid #111827;
            background: #f3f4f6;
            border-radius: 10px;
            color:#374151;
            font-size: 13px;
          ">
            <b>Lưu ý:</b> Không chia sẻ token cho bất kỳ ai để đảm bảo an toàn.
          </div>
        </div>
        `
      );

      return await sendMailSafe({
        from: `"WIND FLOWER" <${MyConstants.EMAIL_USER}>`,
        to: email,
        subject: 'Signup | Verification',
        text,
        html
      });
    } catch (err) {
      console.error('EmailUtil.sendActivation error:', err?.message || err);
      return false;
    }
  },

  async sendStaffWelcome(email, username, password) {
    try {
      const text =
        `Your staff account has been created.\n\n` +
        `Username: ${username}\n` +
        `Password: ${password}\n\n` +
        `Please login and change your password after first sign-in.\n`;

      const html = wrapHTML(
        'Staff Account Created',
        `
        <div style="font-size: 15px; line-height: 1.6;">
          <div style="font-size: 16px; font-weight: 800; margin-bottom: 6px;">
            Tài khoản nhân viên đã được tạo
          </div>
          <div style="color:#374151;">
            Quản trị viên đã tạo tài khoản nhân viên cho bạn. Vui lòng đăng nhập với thông tin dưới đây:
          </div>

          ${badge('Username', username)}
          ${badge('Password (Quan trọng)', password)}

          <div style="
            margin-top: 14px;
            padding: 12px 14px;
            border-left: 4px solid #dc2626;
            background: #fef2f2;
            border-radius: 10px;
            color:#7f1d1d;
            font-size: 13px;
          ">
            <b>Khuyến nghị:</b> Đổi mật khẩu ngay sau lần đăng nhập đầu tiên.
          </div>
        </div>
        `
      );

      return await sendMailSafe({
        from: `"WIND FLOWER" <${MyConstants.EMAIL_USER}>`,
        to: email,
        subject: 'Staff | Account Created',
        text,
        html
      });
    } catch (err) {
      console.error('EmailUtil.sendStaffWelcome error:', err?.message || err);
      return false;
    }
  },

  async sendResetPasswordEmail(email, name, resetLink) {
    try {
      const text =
        `Xin chào ${name || ''}\n\n` +
        `Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản WIND FLOWER.\n` +
        `Vui lòng mở liên kết sau để đặt lại mật khẩu:\n` +
        `${resetLink}\n\n` +
        `Liên kết này sẽ hết hạn sau 15 phút.\n` +
        `Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.\n`;

      const html = wrapHTML(
        'Đặt lại mật khẩu',
        `
        <div style="font-size: 15px; line-height: 1.6;">
          <div style="font-size: 16px; font-weight: 800; margin-bottom: 6px;">
            Xin chào ${name || 'bạn'},
          </div>
          <div style="color:#374151;">
            Bạn vừa yêu cầu <b>đặt lại mật khẩu</b> cho tài khoản WIND FLOWER.
          </div>

          <div style="
            margin-top: 16px;
            padding: 14px;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            background: #f9fafb;
          ">
            <div style="font-size: 13px; color:#374151; margin-bottom: 10px; font-weight: 600;">
              Nhấn nút bên dưới để đặt lại mật khẩu:
            </div>
            <a
              href="${resetLink}"
              target="_blank"
              rel="noreferrer"
              style="
                display: inline-block;
                background: #e91e63;
                color: #ffffff;
                text-decoration: none;
                padding: 12px 18px;
                border-radius: 10px;
                font-weight: 700;
              "
            >
              Đặt lại mật khẩu
            </a>
          </div>

          <div style="
            margin-top: 14px;
            padding: 12px 14px;
            border-left: 4px solid #f59e0b;
            background: #fffbeb;
            border-radius: 10px;
            color:#92400e;
            font-size: 13px;
          ">
            <b>Lưu ý:</b> Liên kết này sẽ hết hạn sau <b>15 phút</b>.
          </div>

          <div style="margin-top: 14px; color:#374151; font-size: 13px;">
            Nếu nút không hoạt động, bạn có thể copy link này và dán vào trình duyệt:
          </div>

          ${badge('Reset Link', resetLink)}
        </div>
        `
      );

      return await sendMailSafe({
        from: `"WIND FLOWER" <${MyConstants.EMAIL_USER}>`,
        to: email,
        subject: 'WIND FLOWER | Đặt lại mật khẩu',
        text,
        html
      });
    } catch (err) {
      console.error('EmailUtil.sendResetPasswordEmail error:', err?.message || err);
      return false;
    }
  }
};

module.exports = EmailUtil;