require("dotenv").config();
const express = require("express");
const path = require("path");
const { OAuth2Client } = require("google-auth-library");
const app = express();
const cors = require("cors");
const PORT = process.env.PORT || 3001;

const client = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;

// Endpoint to provide public config to frontend
const bcrypt = require("bcryptjs");
const sendOtpEmail = require("./utils/sendOtpEmail");

app.get("/api/config", (req, res) => {
  res.json({ status: "ok" });
});

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());

// Content Security Policy (CSP) to fix console errors
app.use((req, res, next) => {
  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://om-services-production.up.railway.app",
    /\.railway\.app$/,
    /\.vercel\.app$/,
  ];

  const origin = req.headers.origin;
  if (
    allowedOrigins.some(
      (ao) =>
        (typeof ao === "string" && ao === origin) ||
        (ao instanceof RegExp && ao.test(origin)),
    )
  ) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, proxy-connection, Connection, User-Agent, Accept, Origin, Accept-Encoding, Accept-Language",
  );

  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net blob:; " +
      "worker-src 'self' blob:; " +
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com https://cdnjs.cloudflare.com; " +
      "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net data:; " +
      "img-src 'self' data: blob: https://i.imgur.com; " +
      "connect-src 'self' https://cdn.jsdelivr.net https://om-services-production.up.railway.app;",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  next();
});

// Request Logger - MUST BE FIRST
app.use((req, res, next) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Serve from /public folder (CSS, JS, assets)
app.use(express.static(path.join(__dirname, "public")));

// ===== DATABASE CONNECTION =====
console.log("🔌 Connecting to MySQL database...");
const sequelize = require("./config/database");

// Import Models
const User = require("./models/User");
const Otp = require("./models/Otp");
const Booking = require("./models/Booking");
const Review = require("./models/Review");
const Partner = require("./models/Partner");
const Service = require("./models/Service");
const PageContent = require("./models/PageContent");

const { Op } = require("sequelize");

async function connectDatabase() {
  try {
    // Ensure database exists on the MySQL server
    const mysql = require("mysql2/promise");
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
    });
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || "om_services"}\`;`);
    await connection.end();

    await sequelize.authenticate();
    console.log("✅ MySQL Connected Successfully!");
    
    // Sync models (creates tables automatically if they don't exist)
    await sequelize.sync({ alter: true });
    console.log("📊 Database models synchronized successfully!");
  } catch (err) {
    console.error("❌ MySQL connection/sync FAILED:", err.message);
    console.log("💡 Retrying database connection in 10 seconds...");
    setTimeout(connectDatabase, 10000);
  }
}
connectDatabase();

// ===== MULTER CONFIGURATION =====
const multer = require("multer");
const fs = require("fs");

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, "uploads");
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (err) {
  console.warn("⚠️ Could not create uploads directory (expected on serverless environments)");
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Memory storage for profile images
const memoryStorage = multer.memoryStorage();
const uploadMemory = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Serve uploads folder statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ===== ADMIN ROUTES =====
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;
  console.log(`🔐 Admin login attempt: ${username}`);

  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    console.log("✅ Admin login successful");
    res.json({ success: true, message: "Welcome Om Service Admin!" });
  } else {
    console.log("❌ Admin login failed");
    res
      .status(401)
      .json({ success: false, message: "Invalid Admin Credentials" });
  }
});

const excelExport = require("./utils/excelExport");
const pdfGenerator = require("./utils/pdfGenerator");

app.post("/api/admin/upload", upload.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    console.log("📸 Admin Image Upload:", req.file.filename);
    const imageUrl = "/uploads/" + req.file.filename;
    res.json({ success: true, imageUrl });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

app.get("/api/admin/analytics", async (req, res) => {
  try {
    console.log("📊 Fetching analytics...");
    const totalBookings = await Booking.count();
    const usersCount = await User.count();
    const reviewsCount = await Review.count();

    const stats = await Booking.findAll({
      attributes: [
        ["serviceType", "_id"],
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["serviceType"],
      raw: true,
    });

    console.log(
      `✅ Analytics: ${totalBookings} bookings, ${usersCount} users, ${reviewsCount} reviews`,
    );

    res.json({
      totalBookings,
      usersCount,
      reviewsCount,
      serviceStats: stats,
    });
  } catch (err) {
    console.error("❌ Analytics error:", err);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

// ===== EXPORT ROUTES =====
app.get("/api/admin/export/excel", excelExport.exportToExcel);
app.get("/api/admin/export/pdf-all", pdfGenerator.generateAllBookingsPDF);
app.get("/api/admin/export/pdf/:id", pdfGenerator.generateBookingPDF);

// ===== BOOKING ROUTES =====
app.get("/api/bookings", async (req, res) => {
  try {
    console.log("📋 Fetching all bookings...");
    const bookings = await Booking.findAll({ order: [["createdAt", "DESC"]] });
    console.log(`✅ Found ${bookings.length} bookings`);
    res.json(bookings);
  } catch (err) {
    console.error("❌ Fetch bookings error:", err);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

app.get("/api/user-bookings/:email", async (req, res) => {
  try {
    console.log(`📋 Fetching bookings for: ${req.params.email}`);
    const bookings = await Booking.findAll({
      where: { email: req.params.email },
      order: [["createdAt", "DESC"]],
    });
    console.log(`✅ Found ${bookings.length} bookings for user`);
    res.json(bookings);
  } catch (err) {
    console.error("❌ User bookings error:", err);
    res.status(500).json({ error: "Failed to fetch user bookings" });
  }
});

// Email Service
const sendBookingEmail = require("./utils/sendEmail");
const sendPartnerEmail = require("./utils/sendPartnerEmail");

app.post("/api/bookings", async (req, res) => {
  try {
    console.log("📝 Creating new booking...");
    console.log("📦 Booking data:", req.body);

    if (!req.body.name || !req.body.serviceType) {
      console.log("❌ Missing required fields");
      return res.status(400).json({
        success: false,
        error: "Name and Service Type are required",
      });
    }

    const savedBooking = await Booking.create({
      ...req.body,
      status: "Pending",
      statusHistory: [
        {
          status: "Pending",
          changedAt: new Date(),
          note: "Booking created",
        },
      ],
    });

    console.log("✅ Booking saved successfully!");
    console.log("🆔 Booking ID:", savedBooking.id);

    // Send confirmation email
    console.log("📧 Attempting to send confirmation email...");
    sendBookingEmail(savedBooking.email, savedBooking)
      .then(() => console.log("✅ Email workflow complete"))
      .catch((err) => console.error("⚠️ Email handling error:", err));

    res.json({
      success: true,
      booking: savedBooking,
      message: "Booking created successfully",
    });
  } catch (err) {
    console.error("❌ CREATE BOOKING ERROR:", err);
    res.status(500).json({
      success: false,
      error: "Failed to create booking",
      details: err.message,
    });
  }
});

app.put("/api/bookings/:id", async (req, res) => {
  try {
    console.log(`✏️ Updating booking: ${req.params.id}`);
    const booking = await Booking.findByPk(req.params.id);

    if (!booking) {
      console.log("❌ Booking not found");
      return res.status(404).json({ error: "Booking not found" });
    }

    await booking.update(req.body);

    console.log("✅ Booking updated successfully");
    res.json({ success: true, booking });
  } catch (err) {
    console.error("❌ Update error:", err);
    res.status(500).json({ error: "Update failed" });
  }
});

app.delete("/api/bookings/:id", async (req, res) => {
  try {
    console.log(`🗑️ Deleting booking: ${req.params.id}`);
    const booking = await Booking.findByPk(req.params.id);

    if (!booking) {
      console.log("❌ Booking not found");
      return res.status(404).json({ error: "Booking not found" });
    }

    await booking.destroy();

    console.log("✅ Booking deleted successfully");
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Delete error:", err);
    res.status(500).json({ error: "Delete failed" });
  }
});

// ===== REVIEW ROUTES =====
app.get("/api/reviews", async (req, res) => {
  try {
    const reviews = await Review.findAll({ order: [["createdAt", "DESC"]] });
    res.json(reviews);
  } catch (err) {
    console.error("❌ Reviews fetch error:", err);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

if (process.env.NODE_ENV !== "production") {
  app.get("/api/debug-reviews", async (req, res) => {
    const reviews = await Review.findAll({
      attributes: ["email", "name", "rating", "serviceType", "createdAt"],
      raw: true,
    });
    res.json({ total: reviews.length, reviews });
  });
}

app.get("/api/user-reviews/:email", async (req, res) => {
  try {
    console.log(`📋 Fetching reviews for: ${req.params.email}`);
    // MySQL checks are case-insensitive by default with LIKE comparisons
    const reviews = await Review.findAll({
      where: {
        email: { [Op.like]: req.params.email },
      },
      order: [["createdAt", "DESC"]],
    });
    res.json(reviews);
  } catch (err) {
    console.error("❌ User reviews fetch error:", err);
    res.status(500).json({ error: "Failed to fetch user reviews" });
  }
});

app.post("/api/reviews", async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.email) data.email = data.email.toLowerCase();
    const review = await Review.create(data);
    console.log("✅ Review saved");
    res.json({ success: true, review });
  } catch (err) {
    console.error("❌ Review save error:", err);
    res.status(500).json({ error: "Failed to post review" });
  }
});

app.put("/api/reviews/:id", async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.email) data.email = data.email.toLowerCase();

    console.log(`✏️ Updating review: ${req.params.id}`);
    const review = await Review.findByPk(req.params.id);

    if (!review) {
      console.log("❌ Review not found");
      return res.status(404).json({ error: "Review not found" });
    }

    await review.update(data);

    console.log("✅ Review updated successfully");
    res.json({ success: true, review });
  } catch (err) {
    console.error("❌ Review update error:", err);
    res.status(500).json({ error: "Failed to update review" });
  }
});

app.delete("/api/reviews/:id", async (req, res) => {
  try {
    console.log(`🗑️ Deleting review: ${req.params.id}`);
    const review = await Review.findByPk(req.params.id);
    if (!review) return res.status(404).json({ error: "Review not found" });
    await review.destroy();
    res.json({ success: true, message: "Review deleted" });
  } catch (err) {
    console.error("❌ Review delete error:", err);
    res.status(500).json({ error: "Failed to delete review" });
  }
});

// ===== CUSTOM AUTH ROUTES =====

// 1. Send OTP & Prepare Registration
app.post("/api/auth/send-otp", async (req, res) => {
  try {
    const { email, phone, name, address, password } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: "Email, password, and name are required." });
    }

    const existingUser = await User.findOne({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      return res.status(400).json({ error: "User with this email already exists." });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Save/Update to Otp table
    const existingOtp = await Otp.findOne({ where: { email: email.toLowerCase() } });
    const userData = { email: email.toLowerCase(), phone, name, address, password: hashedPassword };

    if (existingOtp) {
      await existingOtp.update({ otp, userData, updatedAt: new Date() });
    } else {
      await Otp.create({ email: email.toLowerCase(), otp, userData });
    }

    await sendOtpEmail(email, otp);

    res.json({ success: true, message: "OTP sent to email." });
  } catch (err) {
    console.error("❌ Send OTP Error:", err);
    res.status(500).json({ error: "Failed to send OTP.", details: err.message || err.toString() });
  }
});

// 2. Verify OTP & Complete Registration
app.post("/api/auth/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    const otpRecord = await Otp.findOne({ where: { email: email.toLowerCase() } });
    if (!otpRecord) {
      return res.status(400).json({ error: "OTP expired or not found. Please resend." });
    }

    // Manual check: Check if OTP is older than 5 minutes
    const ageInMilliseconds = new Date() - new Date(otpRecord.updatedAt || otpRecord.createdAt);
    if (ageInMilliseconds > 5 * 60 * 1000) {
      await otpRecord.destroy();
      return res.status(400).json({ error: "OTP expired. Please request a new one." });
    }

    if (otpRecord.otp !== otp) {
      return res.status(400).json({ error: "Invalid OTP." });
    }

    const userData = otpRecord.userData;
    const newUser = await User.create({
      name: userData.name,
      email: userData.email,
      phone: userData.phone,
      address: userData.address,
      password: userData.password,
      isProfileComplete: true,
    });

    await otpRecord.destroy();

    console.log("✅ User registered successfully:", newUser.email);
    res.json({ success: true, message: "Registration successful", user: newUser });
  } catch (err) {
    console.error("❌ Verify OTP Error:", err);
    res.status(500).json({ error: "Failed to verify OTP." });
  }
});

// 3. Simple Login returning User details
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (!user) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    if (!user.password) {
      return res.status(400).json({
        error:
          "Please use forgot password or contact admin to reset your password. (Account was linked to external provider)",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    console.log("✅ User logged in:", user.email);
    const safeUser = user.get({ plain: true });
    delete safeUser.password;
    res.json({ success: true, message: "Login successful", user: safeUser });
  } catch (err) {
    console.error("❌ Login Error:", err);
    res.status(500).json({ error: "Failed to login." });
  }
});

// 4. Forgot Password - Send OTP
app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required." });

    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (!user) {
      return res.status(404).json({ error: "User not found with this email." });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const existingOtp = await Otp.findOne({ where: { email: email.toLowerCase() } });
    if (existingOtp) {
      await existingOtp.update({ otp, updatedAt: new Date() });
    } else {
      await Otp.create({ email: email.toLowerCase(), otp });
    }

    await sendOtpEmail(email, otp);

    res.json({ success: true, message: "Reset OTP sent to your email." });
  } catch (err) {
    console.error("❌ Forgot Password Error:", err);
    res.status(500).json({
      error: "Failed to send reset OTP.",
      details: err.message || err.toString(),
    });
  }
});

// 5. Reset Password with OTP
app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: "Email, OTP, and new password are required." });
    }

    const otpRecord = await Otp.findOne({ where: { email: email.toLowerCase() } });
    if (!otpRecord || otpRecord.otp !== otp) {
      return res.status(400).json({ error: "Invalid or expired OTP." });
    }

    // Manual check: Check if OTP is older than 5 minutes
    const ageInMilliseconds = new Date() - new Date(otpRecord.updatedAt || otpRecord.createdAt);
    if (ageInMilliseconds > 5 * 60 * 1000) {
      await otpRecord.destroy();
      return res.status(400).json({ error: "OTP expired. Please request a new one." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (!user) return res.status(404).json({ error: "User not found." });

    await user.update({ password: hashedPassword });
    await otpRecord.destroy();

    console.log("✅ Password reset successfully for:", email);
    res.json({ success: true, message: "Password updated successfully. You can now sign in." });
  } catch (err) {
    console.error("❌ Reset Password Error:", err);
    res.status(500).json({ error: "Failed to reset password." });
  }
});

// ===== USER ROUTES =====
app.get("/api/user-by-email/:email", async (req, res) => {
  try {
    const normalizedEmail = req.params.email.toLowerCase();
    const user = await User.findOne({
      where: {
        email: { [Op.like]: normalizedEmail },
      },
    });
    console.log(`[EMAIL] ${normalizedEmail} - ${user ? "Found" : "Not Found"}`);
    if (user) {
      const safeUser = user.get({ plain: true });
      delete safeUser.password;
      res.json(safeUser);
    } else {
      res.json({ success: false });
    }
  } catch (err) {
    console.error("❌ Email fetch error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

app.post(
  "/api/user/update",
  uploadMemory.single("profileImage"),
  async (req, res) => {
    try {
      console.log("🔄 Profile Update Request");
      const { email, ...bodyData } = req.body;

      if (!email) {
        console.log("❌ Missing Email");
        return res.status(400).json({ error: "Email is required" });
      }

      const normalizedEmail = email.toLowerCase();
      const updateData = { ...bodyData };
      updateData.isProfileComplete = true;

      if (req.file) {
        console.log("📸 Processing new profile image (Memory -> Base64)");
        const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
        updateData.profileImage = base64Image;
        console.log("✅ Image converted to Base64");
      }

      console.log(`[UPDATE] Email=${normalizedEmail}`);

      const existingUser = await User.findOne({ where: { email: normalizedEmail } });
      let user;
      if (existingUser) {
        user = await existingUser.update(updateData);
      } else {
        user = await User.create({ email: normalizedEmail, ...updateData });
      }

      const safeUser = user.get({ plain: true });
      delete safeUser.password;

      console.log("✅ Profile saved to MySQL:", user.id);
      res.json({ success: true, user: safeUser });
    } catch (err) {
      console.error("❌ Profile update error:", err);
      res.status(500).json({ error: "Database update failed" });
    }
  },
);

// ===== JOIN / PARTNER ROUTES =====
app.post("/api/join", uploadMemory.array("images", 5), async (req, res) => {
  try {
    console.log("🤝 New Partner Request:", req.body.category, req.body.name);

    const imagePaths = req.files
      ? req.files.map((file) => {
          return `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
        })
      : [];

    let details = req.body.details;
    if (Array.isArray(details)) {
      details = details.filter((d) => d && d.trim().length > 0).join("\n");
    }

    const partnerData = {
      ...req.body,
      details: details || "",
      images: imagePaths,
    };

    const newPartner = await Partner.create(partnerData);
    console.log("✅ Partner request saved to MySQL:", newPartner.id);

    if (req.body.email) {
      console.log("📧 Sending welcome email to", req.body.email);
      sendPartnerEmail(req.body.email, {
        name: req.body.name,
        category: req.body.category,
      }).catch((e) => console.error("Email failed", e));
    }

    res.json({ success: true, message: "Request submitted successfully!" });
  } catch (err) {
    console.error("❌ Join request error:", err);
    res.status(500).json({ success: false, error: "Submission failed" });
  }
});

const sendApprovalEmail = require("./utils/sendApprovalEmail");
const sendPartnerCodeEmail = require("./utils/sendPartnerCodeEmail");

app.get("/api/partners", async (req, res) => {
  try {
    console.log("📋 Fetching all partner applications...");
    const partners = await Partner.findAll({ order: [["createdAt", "DESC"]] });
    console.log(`✅ Found ${partners.length} partner applications`);
    res.json(partners);
  } catch (err) {
    console.error("❌ Partners fetch error:", err);
    res.status(500).json({ error: "Failed to fetch partners" });
  }
});

app.get("/api/partners/approved", async (req, res) => {
  try {
    const { category } = req.query;
    const whereQuery = { status: "Approved" };
    if (category) {
      whereQuery.category = { [Op.like]: category };
    }
    const partners = await Partner.findAll({
      where: whereQuery,
      order: [["updatedAt", "DESC"]],
    });
    res.json(partners);
  } catch (err) {
    console.error("❌ Approved partners fetch error:", err);
    res.status(500).json({ error: "Failed to fetch approved partners" });
  }
});

app.delete("/api/partners/:id", async (req, res) => {
  try {
    console.log(`🗑️ Deleting partner: ${req.params.id}`);
    const partner = await Partner.findByPk(req.params.id);
    if (!partner) return res.status(404).json({ error: "Not found" });
    await partner.destroy();
    console.log("✅ Partner deleted:", req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Partner delete error:", err);
    res.status(500).json({ error: "Delete failed" });
  }
});

app.put("/api/partners/:id/approve", async (req, res) => {
  try {
    const { adminNote } = req.body;
    const partner = await Partner.findByPk(req.params.id);
    if (!partner) return res.status(404).json({ error: "Not found" });

    await partner.update({
      status: "Approved",
      adminNote: adminNote || "",
    });

    if (partner.email) {
      sendApprovalEmail(partner.email, partner, true, adminNote || "").catch(
        (e) => console.error("Approval email failed:", e),
      );
    }

    sendPartnerCodeEmail(partner).catch((e) =>
      console.error("Admin Code snippet email failed:", e),
    );

    console.log("✅ Partner approved:", partner.name);
    res.json({ success: true, partner });
  } catch (err) {
    console.error("❌ Partner approve error:", err);
    res.status(500).json({ error: "Approve failed" });
  }
});

app.put("/api/partners/:id/reject", async (req, res) => {
  try {
    const { adminNote } = req.body;
    const partner = await Partner.findByPk(req.params.id);
    if (!partner) return res.status(404).json({ error: "Not found" });

    await partner.update({
      status: "Rejected",
      adminNote: adminNote || "",
    });

    if (partner.email) {
      sendApprovalEmail(partner.email, partner, false, adminNote || "").catch(
        (e) => console.error("Rejection email failed:", e),
      );
    }

    console.log("✅ Partner rejected:", partner.name);
    res.json({ success: true, partner });
  } catch (err) {
    console.error("❌ Partner reject error:", err);
    res.status(500).json({ error: "Reject failed" });
  }
});

// ===== SERVICE ROUTES =====
app.get("/api/services", async (req, res) => {
  try {
    const { category } = req.query;
    const whereQuery = {};
    if (category) whereQuery.category = category;

    const services = await Service.findAll({ where: whereQuery });
    res.json(services);
  } catch (err) {
    console.error("❌ Service fetch error:", err);
    res.status(500).json({ error: "Failed to fetch services" });
  }
});

app.post("/api/services", async (req, res) => {
  try {
    const { category, images, discount, description, packages } = req.body;
    console.log(`🛠️ Updating service: ${category}`);

    const existing = await Service.findOne({ where: { category } });
    let service;
    if (existing) {
      service = await existing.update({ images, discount, description, packages });
    } else {
      service = await Service.create({ category, images, discount, description, packages });
    }

    console.log("✅ Service updated successfully");
    res.json({ success: true, service });
  } catch (err) {
    console.error("❌ Service update error:", err);
    res.status(500).json({ error: "Failed to update service" });
  }
});

app.delete("/api/services/:category/image", async (req, res) => {
  try {
    const { category } = req.params;
    const { imageUrl } = req.body;
    console.log(`🗑️ Removing image from ${category}: ${imageUrl}`);

    const service = await Service.findOne({ where: { category } });
    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }

    const newImages = service.images.filter((img) => img !== imageUrl);
    await service.update({ images: newImages });

    console.log("✅ Image removed successfully");
    res.json({ success: true, service });
  } catch (err) {
    console.error("❌ Image remove error:", err);
    res.status(500).json({ error: "Failed to remove image" });
  }
});

app.post(
  "/api/services/:category/image/update",
  upload.single("image"),
  async (req, res) => {
    try {
      const { category } = req.params;
      const { oldImageUrl } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const newImageUrl = "/uploads/" + req.file.filename;
      console.log(
        `🔄 Replacing image in ${category}: ${oldImageUrl} → ${newImageUrl}`,
      );

      const service = await Service.findOne({ where: { category } });
      if (!service) {
        return res.status(404).json({ error: "Service not found" });
      }

      const images = [...(service.images || [])];
      const idx = images.indexOf(oldImageUrl);
      if (idx !== -1) {
        images[idx] = newImageUrl;
      } else {
        images.push(newImageUrl);
      }
      await service.update({ images });

      console.log("✅ Image replaced successfully");
      res.json({ success: true, newImageUrl, service });
    } catch (err) {
      console.error("❌ Image replace error:", err);
      res.status(500).json({ error: "Failed to replace image" });
    }
  },
);

app.post(
  "/api/services/:category/image/add",
  upload.single("image"),
  async (req, res) => {
    try {
      const { category } = req.params;

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const newImageUrl = "/uploads/" + req.file.filename;
      console.log(`➕ Adding image to ${category}: ${newImageUrl}`);

      const service = await Service.findOne({ where: { category } });
      if (service) {
        const images = [...(service.images || []), newImageUrl];
        await service.update({ images });
        res.json({ success: true, newImageUrl, service });
      } else {
        const newService = await Service.create({
          category,
          images: [newImageUrl]
        });
        res.json({ success: true, newImageUrl, service: newService });
      }
      console.log("✅ Image added successfully");
    } catch (err) {
      console.error("❌ Image add error:", err);
      res.status(500).json({ error: "Failed to add image" });
    }
  },
);

// ===== PAGE CONTENT ROUTES =====
app.get("/api/page-content", async (req, res) => {
  try {
    const pages = await PageContent.findAll();
    res.json(pages);
  } catch (err) {
    console.error("❌ Page content fetch error:", err);
    res.status(500).json({ error: "Failed to fetch page content" });
  }
});

app.get("/api/page-content/:pageId", async (req, res) => {
  try {
    const page = await PageContent.findOne({ where: { pageId: req.params.pageId } });
    res.json(page || {});
  } catch (err) {
    console.error("❌ Page content fetch error:", err);
    res.status(500).json({ error: "Failed to fetch page content" });
  }
});

app.post("/api/page-content/:pageId", async (req, res) => {
  try {
    const { pageId } = req.params;
    const updateData = { ...req.body };
    console.log(`📄 Updating page content: ${pageId}`);

    const existing = await PageContent.findOne({ where: { pageId } });
    let page;
    if (existing) {
      page = await existing.update(updateData);
    } else {
      page = await PageContent.create({ pageId, ...updateData });
    }
    console.log("✅ Page content updated");
    res.json({ success: true, page });
  } catch (err) {
    console.error("❌ Page content update error:", err);
    res.status(500).json({ error: "Failed to update page content" });
  }
});

app.post(
  "/api/page-content/:pageId/upload",
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const imageUrl = "/uploads/" + req.file.filename;
      const { pageId } = req.params;
      const { sectionId, field } = req.body;

      console.log(`📸 Page image upload: ${pageId}/${sectionId || field}`);

      const page = await PageContent.findOne({ where: { pageId } });
      if (page) {
        if (sectionId) {
          let sections = [...(page.sections || [])];
          const section = sections.find((s) => s.sectionId === sectionId);
          if (section) {
            section.images = [...(section.images || []), imageUrl];
          } else {
            sections.push({ sectionId, images: [imageUrl], title: "", subtitle: "", text: "", videos: [], items: [] });
          }
          await page.update({ sections, updatedAt: new Date() });
          return res.json({ success: true, imageUrl, page });
        } else if (field === "heroImage") {
          await page.update({ heroImage: imageUrl, updatedAt: new Date() });
          return res.json({ success: true, imageUrl, page });
        }
      } else {
        const sectionsData = sectionId ? [{ sectionId, images: [imageUrl], title: "", subtitle: "", text: "", videos: [], items: [] }] : [];
        const heroImageData = field === "heroImage" ? imageUrl : "";
        const newPage = await PageContent.create({
          pageId,
          sections: sectionsData,
          heroImage: heroImageData
        });
        return res.json({ success: true, imageUrl, page: newPage });
      }
      res.json({ success: true, imageUrl });
    } catch (err) {
      console.error("❌ Page image upload error:", err);
      res.status(500).json({ error: "Upload failed" });
    }
  },
);

app.delete("/api/page-content/:pageId/image", async (req, res) => {
  try {
    const { pageId } = req.params;
    const { imageUrl, sectionId, field } = req.body;
    console.log(`🗑️ Removing page image: ${pageId}/${imageUrl}`);

    const page = await PageContent.findOne({ where: { pageId } });
    if (!page) return res.status(404).json({ error: "Page not found" });

    if (field === "heroImage") {
      await page.update({ heroImage: "" });
    } else if (sectionId) {
      let sections = [...(page.sections || [])];
      const section = sections.find((s) => s.sectionId === sectionId);
      if (section) {
        section.images = section.images.filter((img) => img !== imageUrl);
        await page.update({ sections });
      }
    }

    res.json({ success: true, page });
  } catch (err) {
    console.error("❌ Page image remove error:", err);
    res.status(500).json({ error: "Failed to remove image" });
  }
});

// ===== PAGE ROUTES =====
app.get("/:file", (req, res, next) => {
  const fileName = req.params.file;
  const ext = fileName.split(".").pop().toLowerCase();
  const allowedExtensions = ["png", "jpg", "jpeg", "gif", "ico", "svg"];

  if (allowedExtensions.includes(ext)) {
    const filePath = path.join(__dirname, fileName);
    if (require("fs").existsSync(filePath)) {
      return res.sendFile(filePath);
    }
  }
  next();
});

app.get("/:page.html", (req, res) => {
  const filePath = path.join(__dirname, req.params.page + ".html");
  if (require("fs").existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send("Page not found");
  }
});

const commonPages = ["signin", "about", "contact", "user-dashboard", "reviews", "go", "join", "offers", "review"];
commonPages.forEach(p => {
  app.get(`/${p}`, (req, res) => res.sendFile(path.join(__dirname, `${p}.html`)));
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log("\n" + "=".repeat(50));
  console.log("🚀 OM SERVICE - SERVER STARTED");
  console.log("=".repeat(50));
  console.log(`📍 Port: ${PORT}`);
  console.log(`🔗 URL: http://localhost:${PORT}`);
  console.log(`🔗 Admin: http://localhost:${PORT}/admin.html`);
  console.log("=".repeat(50) + "\n");
});

module.exports = app;

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down server...");
  await sequelize.close();
  console.log("✅ MySQL connection closed");
  process.exit(0);
});
