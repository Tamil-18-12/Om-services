const nodemailer = require("nodemailer");

const sendPartnerEmail = async (toEmail, partnerDetails) => {
  try {
    console.log("Initializing Nodemailer (Partner) with IPv4 and explicit SMTP settings...");
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true, // true for 465, false for other ports
      family: 4, // Force IPv4 to fix DNS timeouts
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
        from: `"Om Services" <${process.env.EMAIL_USER}>`,
        to: toEmail,
      subject: `Welcome to the Squad! - ${partnerDetails.category} Partner`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
                .header { background: #37023e; padding: 30px 20px; text-align: center; }
                .logo-text { color: #FFD700; font-size: 28px; font-weight: bold; margin: 0; letter-spacing: 2px; text-transform: uppercase; }
                .subtitle { color: #cccccc; margin: 5px 0 0; font-size: 14px; letter-spacing: 1px; }
                .content { padding: 40px 30px; }
                .welcome-text { font-size: 24px; color: #37023e; font-weight: bold; text-align: center; margin-bottom: 20px; }
                .message-body { font-size: 16px; color: #555; text-align: center; margin-bottom: 30px; }
                .contact-box { background: #fff8e1; border: 1px dashed #FFD700; padding: 20px; text-align: center; border-radius: 8px; margin-top: 30px; }
                .contact-number { font-size: 24px; color: #1a1a1a; font-weight: bold; text-decoration: none; display: block; margin-top: 5px;}
                .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #888; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1 class="logo-text">OM SERVICE</h1>
                    <p class="subtitle">Join Our Network</p>
                </div>
                <div class="content">
                    <div class="welcome-text">You Join Our Squad! 🚀</div>
                    <div class="message-body">
                        <p>Welcome <strong>${partnerDetails.name}</strong>,</p>
                        <p>Thank you for your interest in partnering with us for <strong>${partnerDetails.category}</strong>.</p>
                        <p>Our team will contact you soon to verify your details and onboard you.</p>
                    </div>

                    <div class="contact-box">
                        <p style="margin: 0 0 6px; color: #555; font-weight: 600;">Any doubts? Contact us:</p>
                        <a href="mailto:omservice.live@gmail.com" class="contact-number" style="font-size:16px;">✉️ omservice.live@gmail.com</a>
                        <a href="tel:8870043071" class="contact-number" style="font-size:22px; margin-top:5px;">📱 8870043071</a>
                    </div>
                </div>
                <div class="footer">
                    <p>Om Services Team</p>
                </div>
            </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Partner email sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ Email error:", error);
    // Don't throw error to avoid crashing the process
    return null;
  }
};

module.exports = sendPartnerEmail;
