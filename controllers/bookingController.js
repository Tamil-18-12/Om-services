const Booking = require("../models/Booking");
const User = require("../models/User");
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const {
  sendBookingConfirmation,
  sendAdminNotification,
} = require("../utils/emailService");

// Create Booking
exports.createBooking = async (req, res) => {
  try {
    const bookingData = req.body;

    // Create new booking with default status
    const booking = await Booking.create({
      ...bookingData,
      status: "Pending",
      statusHistory: [
        {
          status: "Pending",
          changedAt: new Date(),
          note: "Booking created",
        },
      ],
    });

    // Send confirmation emails
    try {
      if (booking.email) {
        await sendBookingConfirmation(booking);
      }
      await sendAdminNotification(booking);
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
      // Don't fail the booking if email fails
    }

    res.status(201).json({
      success: true,
      message: "Booking created successfully",
      booking,
    });
  } catch (error) {
    console.error("Create booking error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create booking",
      error: error.message,
    });
  }
};

// Get All Bookings with Filters and Pagination
exports.getAllBookings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      serviceType,
      status,
      search,
      startDate,
      endDate,
    } = req.query;

    // Build filter query
    const filter = {};

    if (serviceType) {
      filter.serviceType = serviceType;
    }

    if (status) {
      filter.status = status;
    }

    if (search) {
      filter[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt[Op.gte] = new Date(startDate);
      if (endDate) filter.createdAt[Op.lte] = new Date(endDate);
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get bookings with pagination
    const bookings = await Booking.findAll({
      where: filter,
      order: [["createdAt", "DESC"]],
      offset: parseInt(skip),
      limit: parseInt(limit),
    });

    // Get total count
    const total = await Booking.count({ where: filter });

    res.json({
      success: true,
      bookings,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get bookings error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bookings",
      error: error.message,
    });
  }
};

// Get Single Booking
exports.getBooking = async (req, res) => {
  try {
    const booking = await Booking.findByPk(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    res.json({
      success: true,
      booking,
    });
  } catch (error) {
    console.error("Get booking error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch booking",
      error: error.message,
    });
  }
};

// Update Booking
exports.updateBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const booking = await Booking.findByPk(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Track status change
    if (updateData.status && updateData.status !== booking.status) {
      const history = [...(booking.statusHistory || [])];
      history.push({
        status: updateData.status,
        changedAt: new Date(),
        changedBy: req.adminId || "admin",
        note:
          updateData.statusNote || `Status changed to ${updateData.status}`,
      });
      booking.statusHistory = history;
    }

    // Update fields
    Object.keys(updateData).forEach((key) => {
      if (key !== "statusNote") {
        booking[key] = updateData[key];
      }
    });

    booking.updatedAt = new Date();
    await booking.save();

    res.json({
      success: true,
      message: "Booking updated successfully",
      booking,
    });
  } catch (error) {
    console.error("Update booking error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update booking",
      error: error.message,
    });
  }
};

// Delete Booking
exports.deleteBooking = async (req, res) => {
  try {
    const booking = await Booking.findByPk(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    await booking.destroy();

    res.json({
      success: true,
      message: "Booking deleted successfully",
    });
  } catch (error) {
    console.error("Delete booking error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete booking",
      error: error.message,
    });
  }
};

// Get Booking Statistics
exports.getStatistics = async (req, res) => {
  try {
    const stats = await Booking.findAll({
      attributes: [
        ["serviceType", "_id"],
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        [sequelize.fn("SUM", sequelize.col("totalAmount")), "totalAmount"],
      ],
      group: ["serviceType"],
      raw: true,
    });

    const statusStats = await Booking.findAll({
      attributes: [
        ["status", "_id"],
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["status"],
      raw: true,
    });

    const totalBookings = await Booking.count();

    res.json({
      success: true,
      statistics: {
        total: totalBookings,
        byService: stats,
        byStatus: statusStats,
      },
    });
  } catch (error) {
    console.error("Get statistics error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
      error: error.message,
    });
  }
};

// Get User's Bookings (by Email)
exports.getUserBookings = async (req, res) => {
  try {
    // Fetch user to get email
    const user = await User.findByPk(req.userId || req.adminId); // Handle both for safety

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const bookings = await Booking.findAll({
      where: { email: user.email },
      order: [["createdAt", "DESC"]],
    });

    res.json({
      success: true,
      bookings,
    });
  } catch (error) {
    console.error("Get user bookings error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bookings",
      error: error.message,
    });
  }
};
