import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

const createTransporter = () => {
    if (process.env.NODE_ENV === 'development') {
        return nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            auth: {
                user: process.env.SMTP_USER || 'ethereal_user',
                pass: process.env.SMTP_PASS || 'ethereal_pass',
            },
        });
    }

    // Production SMTP (SendGrid / any provider)
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false, // TLS via STARTTLS on port 587
        auth: {
            user: process.env.SMTP_USER,
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
        // Log but don't throw — email failure should never crash an API request
        // The user still gets registered/reset — just retry email manually
        logger.error(`Email send failed → to: ${to} | error: ${error.message}`);
        throw error; // re-throw so caller can decide whether to surface the error
    }
};
