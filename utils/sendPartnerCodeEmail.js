const nodemailer = require('nodemailer');

const sendPartnerCodeEmail = async (partnerDetails) => {
    try {
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            family: 4,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        // The exact HTML snippet to add to the main page or category page
        // Format it nicely using Bootstrap like the existing cards
        const htmlCodeSnippet = `
<!-- START AUTOMATICALLY GENERATED PARTNER CARD for ${partnerDetails.name} -->
<div class="col-lg-4 col-md-6 mb-4">
    <div class="service-card h-100 shadow-sm border-0 rounded-4 overflow-hidden position-relative group">
        <div class="card-img-wrap" style="height: 200px; overflow: hidden;">
            <img src="${partnerDetails.images && partnerDetails.images.length > 0 ? partnerDetails.images[0] : 'placeholder.jpg'}" class="w-100 h-100 object-fit-cover" alt="${partnerDetails.name}">
            <div class="overlay position-absolute top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-flex align-items-center justify-content-center opacity-0 group-hover-opacity-100 transition">
                <a href="${partnerDetails.category.toLowerCase()}.html" class="btn btn-warning fw-bold rounded-pill shadow">Book Now</a>
            </div>
        </div>
        <div class="card-body p-4 bg-white">
            <span class="badge bg-warning text-dark mb-2 px-3 py-2 rounded-pill fw-bold">${partnerDetails.category}</span>
            <h4 class="card-title fw-bold text-dark mb-2">${partnerDetails.name}</h4>
            <p class="text-secondary small mb-3">
                <i class="fas fa-map-marker-alt text-warning me-1"></i> ${partnerDetails.address}
            </p>
            ${partnerDetails.vehicleModel ? `<p class="text-dark small mb-1"><strong><i class="fas fa-car me-2"></i>Vehicle:</strong> ${partnerDetails.vehicleModel}</p>` : ''}
            ${partnerDetails.cameraModel ? `<p class="text-dark small mb-1"><strong><i class="fas fa-camera me-2"></i>Gear:</strong> ${partnerDetails.cameraModel}</p>` : ''}
            ${partnerDetails.menuItems ? `<p class="text-dark small mb-1"><strong><i class="fas fa-utensils me-2"></i>Menu:</strong> ${partnerDetails.menuItems}</p>` : ''}
            ${partnerDetails.sweetType ? `<p class="text-dark small mb-1"><strong><i class="fas fa-ice-cream me-2"></i>Type:</strong> ${partnerDetails.sweetType}</p>` : ''}
            <hr class="text-muted my-3">
            <div class="d-flex justify-content-between align-items-center">
                <span class="text-success fw-bold"><i class="fas fa-phone-alt me-1"></i> ${partnerDetails.mobile}</span>
            </div>
        </div>
    </div>
</div>
<!-- END AUTOMATICALLY GENERATED PARTNER CARD -->
        `.trim();

        // Encode HTML to be displayed inside an email pre tag
        const escapedHtmlCode = htmlCodeSnippet
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

        const adminHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f4f4f4; padding: 20px; }
                .container { max-width: 800px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 30px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
                h2 { color: #1a1a1a; margin-top: 0; }
                .code-box { background: #1e1e1e; color: #d4d4d4; padding: 20px; border-radius: 8px; overflow-x: auto; font-family: monospace; font-size: 14px; margin-top: 20px; line-height: 1.5; white-space: pre-wrap; }
                .alert-info { background: #e0f2fe; color: #0284c7; padding: 15px; border-radius: 6px; border-left: 4px solid #0ea5e9; margin-bottom: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>New Partner Approved: ${partnerDetails.name}</h2>
                <div class="alert-info">
                    <strong>Notice:</strong> You recently approved this partner from the Admin Dashboard. Below is the automatically generated HTML code for this partner. You can copy and paste this code directly into your main HTML files (e.g., <strong>index.html</strong> or <strong>${partnerDetails.category.toLowerCase()}.html</strong>) to make it live for users!
                </div>
                
                <h3>Partner Details:</h3>
                <ul>
                    <li><strong>Name:</strong> ${partnerDetails.name}</li>
                    <li><strong>Category:</strong> ${partnerDetails.category}</li>
                    <li><strong>Mobile:</strong> ${partnerDetails.mobile}</li>
                    <li><strong>Location:</strong> ${partnerDetails.address}</li>
                </ul>

                <h3>HTML Code Snippet:</h3>
                <p>Copy the code below and paste it into the HTML gallery section:</p>
                <div class="code-box">${escapedHtmlCode}</div>
            </div>
        </body>
        </html>`;

        const mailOptions = {
            from: `"Om Services Admin System" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_USER, // Send TO the admin email itself (omservice.live@gmail.com)
            subject: `[HTML Code] New Partner Approved: ${partnerDetails.name}`,
            html: adminHtml
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Admin code snippet email sent for ${partnerDetails.name}:`, info.messageId);
        return info;
    } catch (error) {
        console.error('❌ Admin code snippet email error:', error);
        return null;
    }
};

module.exports = sendPartnerCodeEmail;
