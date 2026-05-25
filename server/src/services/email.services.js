
import nodemailer from 'nodemailer';
import { logger } from '../config/logger.js';

const createTransporter = () => {
  // if (process.env.NODE_ENV === 'development') {
  //     return nodemailer.createTransport({
  //         host: 'smtp.ethereal.email',
  //         port: 587,
  //         auth: {
  //             user: process.env.SMTP_USER || 'ethereal_user',
  //             pass: process.env.SMTP_PASS || 'ethereal_pass',
  //         },
  //     });
  // }

  
  // Production SMTP (SendGrid / any provider)
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false, // TLS via STARTTLS on port 587
    auth: {
      user: process.env.SMTP_USER ,
      pass: process.env.SMTP_PASS,
    },
    pool: true,        // reuse connections → faster for bulk sends
    maxConnections: 5, // max 5 simultaneous SMTP connections
  });
  
}

const transporter = createTransporter();

const sendEmail = async ({ to, subject, html }) => {
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || 'Campus Placement Cell'}" <${process.env.EMAIL_FROM || 'noreply@placement.com'}>`,
      to,
      subject,
      html,
    });

    logger.info(`Email sent → to: ${to} | subject: "${subject}" | messageId: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error(`Email send failed → to: ${to} | error: ${error.message}`);
    throw error;
  }
};

const baseTemplate = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    body { font-family: Inter, Arial, sans-serif; background: #f8fafc; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 12px;
                 overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
    .header { background: #2563eb; padding: 28px 32px; }
    .header h1 { color: #fff; margin: 0; font-size: 20px; font-weight: 600; }
    .header p  { color: #bfdbfe; margin: 4px 0 0; font-size: 13px; }
    .body { padding: 32px; color: #374151; font-size: 15px; line-height: 1.6; }
    .btn { display: inline-block; margin: 24px 0; padding: 12px 28px;
           background: #2563eb; color: #fff !important; text-decoration: none;
           border-radius: 8px; font-weight: 600; font-size: 15px; }
    .footer { padding: 20px 32px; border-top: 1px solid #e5e7eb;
              font-size: 12px; color: #9ca3af; }
    .highlight { background: #eff6ff; border-left: 4px solid #2563eb;
                 padding: 12px 16px; border-radius: 4px; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎓 Campus Placement Portal</h1>
      <p>AI-Powered Placement Management</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      This email was sent by Campus Placement Cell. If you did not request this, please ignore it.
    </div>
  </div>
</body>
</html>
`;

// ─── Public Email Functions ───────────────────────────────────────────────────

export const sendVerificationEmail = async (user, verifyUrl) => {
  const html = baseTemplate(`
    <p>Hi <strong>${user.name}</strong>,</p>
    <p>Welcome to Campus Placement Portal! Please verify your email address to activate your account.</p>
    <a href="${verifyUrl}" class="btn">Verify Email Address</a>
    <div class="highlight">
      <strong>This link expires in 24 hours.</strong><br/>
      If the button doesn't work, copy and paste this URL into your browser:<br/>
      <small>${verifyUrl}</small>
    </div>
  `);

  return sendEmail({
    to: user.email,
    subject: 'Verify Your Email — Campus Placement Portal',
    html,
  });
};

// 2. Password reset link
export const sendPasswordResetEmail = async (user, resetUrl) => {
  const html = baseTemplate(`
    <p>Hi <strong>${user.name}</strong>,</p>
    <p>We received a request to reset your password. Click the button below to set a new password.</p>
    <a href="${resetUrl}" class="btn">Reset Password</a>
    <div class="highlight">
      <strong>This link expires in 10 minutes.</strong><br/>
      If you did not request a password reset, please ignore this email — your password will not be changed.
    </div>
  `);

  return sendEmail({
    to: user.email,
    subject: 'Reset Your Password — Campus Placement Portal',
    html,
  });
};

// 3. Welcome email after email verification confirmed
export const sendWelcomeEmail = async (user) => {
  const dashboardUrl = `${process.env.CLIENT_URL}/${user.role}/dashboard`;

  const html = baseTemplate(`
    <p>Hi <strong>${user.name}</strong>,</p>
    <p>Your email has been verified successfully! Your account is now active.</p>
    <a href="${dashboardUrl}" class="btn">Go to Dashboard</a>
    <p>Here's what you can do next:</p>
    <ul>
      ${user.role === 'student' ? `
        <li>Complete your profile and upload your resume</li>
        <li>Browse available placement drives</li>
        <li>Apply to drives that match your profile</li>
      ` : `
        <li>Complete your company profile</li>
        <li>Wait for admin approval (usually within 24 hours)</li>
        <li>Post placement drives once approved</li>
      `}
    </ul>
  `);

  return sendEmail({
    to: user.email,
    subject: `Welcome to Campus Placement Portal, ${user.name}!`,
    html,
  });
};

// 4. Password changed confirmation
export const sendPasswordChangedEmail = async (user) => {
  const html = baseTemplate(`
    <p>Hi <strong>${user.name}</strong>,</p>
    <p>Your password was successfully changed.</p>
    <div class="highlight">
      <strong>If you did not make this change</strong>, your account may be compromised.
      Please contact the placement office immediately.
    </div>
  `);

  return sendEmail({
    to: user.email,
    subject: 'Password Changed — Campus Placement Portal',
    html,
  });
};
