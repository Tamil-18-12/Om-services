const XLSX = require("xlsx");
const Booking = require("../models/Booking");
const { Op } = require("sequelize");
const sequelize = require("../config/database");

// Export bookings to Excel
exports.exportToExcel = async (req, res) => {
  try {
    const { serviceType, status, startDate, endDate } = req.query;

    // Build filter
    const filter = {};
    if (serviceType) filter.serviceType = serviceType;
    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt[Op.gte] = new Date(startDate);
      if (endDate) filter.createdAt[Op.lte] = new Date(endDate);
    }

    // Fetch bookings
    const bookings = await Booking.findAll({
      where: filter,
      order: [["createdAt", "DESC"]],
    });

    // Prepare data for Excel
    const excelData = bookings.map((booking) => {
      const baseData = {
        "Booking ID": booking.id.toString().padStart(6, "0"),
        "Service Type": booking.serviceType,
        "Service Name": booking.serviceName,
        "Customer Name": booking.name,
        Age: booking.age || "N/A",
        Phone: booking.phone,
        Email: booking.email || "N/A",
        Address: booking.address || "N/A",
        "Event Date": booking.date,
        Status: booking.status,
        "Booking Date": new Date(booking.createdAt).toLocaleDateString(),
        "Total Amount": booking.totalAmount || "N/A",
        Notes: booking.notes || "N/A",
      };

      // Add service-specific fields
      if (booking.serviceType === "Catering") {
        baseData["Meal Type"] = booking.mealType || "N/A";
        baseData["Guests"] = booking.guests || "N/A";
        baseData["Event Duration"] = booking.eventDuration || "N/A";
      } else if (booking.serviceType === "Travels") {
        baseData["Pickup Location"] = booking.pickupLocation || "N/A";
        baseData["Drop Destination"] = booking.dropDestination || "N/A";
        baseData["Travel Duration"] = booking.travelDuration || "N/A";
        baseData["Passengers"] = booking.passengerCount || "N/A";
      } else if (booking.serviceType === "Photography") {
        baseData["Event Type"] = booking.eventType || "N/A";
        baseData["Photography Duration"] = booking.photographyDuration || "N/A";
      } else if (booking.serviceType === "Sweet Stall") {
        baseData["Sweet Quantity"] = booking.sweetQuantity || "N/A";
        baseData["Function Time"] = booking.functionTime || "N/A";
      }

      return baseData;
    });

    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    const colWidths = [
      { wch: 12 }, // Booking ID
      { wch: 15 }, // Service Type
      { wch: 20 }, // Service Name
      { wch: 20 }, // Customer Name
      { wch: 8 }, // Age
      { wch: 15 }, // Phone
      { wch: 25 }, // Email
      { wch: 30 }, // Address
      { wch: 12 }, // Event Date
      { wch: 12 }, // Status
      { wch: 12 }, // Booking Date
      { wch: 12 }, // Total Amount
      { wch: 30 }, // Notes
    ];
    ws["!cols"] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Bookings");

    // Generate buffer
    const excelBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    // Set response headers
    const filename = `OM_Service_Bookings_${new Date().toISOString().split("T")[0]}.xlsx`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    // Send file
    res.send(excelBuffer);
  } catch (error) {
    console.error("Export to Excel error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export bookings",
      error: error.message,
    });
  }
};

// Export statistics to Excel
exports.exportStatistics = async (req, res) => {
  try {
    // Get service statistics
    const serviceStats = await Booking.findAll({
      attributes: [
        ["serviceType", "serviceType"],
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        [sequelize.fn("SUM", sequelize.col("totalAmount")), "totalAmount"],
      ],
      group: ["serviceType"],
      raw: true,
    });

    // Get status statistics
    const statusStats = await Booking.findAll({
      attributes: [
        ["status", "status"],
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["status"],
      raw: true,
    });

    // Get monthly statistics (last 12 months)
    const monthlyStats = await Booking.findAll({
      attributes: [
        [sequelize.fn("YEAR", sequelize.col("createdAt")), "year"],
        [sequelize.fn("MONTH", sequelize.col("createdAt")), "month"],
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        [sequelize.fn("SUM", sequelize.col("totalAmount")), "totalAmount"],
      ],
      group: [
        sequelize.fn("YEAR", sequelize.col("createdAt")),
        sequelize.fn("MONTH", sequelize.col("createdAt")),
      ],
      order: [
        [sequelize.fn("YEAR", sequelize.col("createdAt")), "DESC"],
        [sequelize.fn("MONTH", sequelize.col("createdAt")), "DESC"],
      ],
      limit: 12,
      raw: true,
    });

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Service Statistics Sheet
    const serviceData = serviceStats.map((s) => ({
      "Service Type": s.serviceType,
      "Total Bookings": s.count,
      "Total Amount": s.totalAmount || 0,
    }));
    const ws1 = XLSX.utils.json_to_sheet(serviceData);
    XLSX.utils.book_append_sheet(wb, ws1, "By Service");

    // Status Statistics Sheet
    const statusData = statusStats.map((s) => ({
      Status: s.status,
      Count: s.count,
    }));
    const ws2 = XLSX.utils.json_to_sheet(statusData);
    XLSX.utils.book_append_sheet(wb, ws2, "By Status");

    // Monthly Statistics Sheet
    const monthlyData = monthlyStats.map((s) => ({
      Year: s.year,
      Month: s.month,
      Bookings: s.count,
      "Total Amount": s.totalAmount || 0,
    }));
    const ws3 = XLSX.utils.json_to_sheet(monthlyData);
    XLSX.utils.book_append_sheet(wb, ws3, "Monthly Trends");

    // Generate buffer
    const excelBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    // Set response headers
    const filename = `OM_Service_Statistics_${new Date().toISOString().split("T")[0]}.xlsx`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    // Send file
    res.send(excelBuffer);
  } catch (error) {
    console.error("Export statistics error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export statistics",
      error: error.message,
    });
  }
};
