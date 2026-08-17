const PDFDocument = require('pdfkit');
const Booking = require('../models/Booking');

// Generate single booking confirmation PDF
exports.generateBookingPDF = async (req, res) => {
    try {
        const { id } = req.params;
        const booking = await Booking.findByPk(id);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Create PDF document
        const doc = new PDFDocument({ margin: 50 });

        // Set response headers
        const filename = `Booking_${booking.id.toString().padStart(6, '0')}.pdf`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/pdf');

        // Pipe PDF to response
        doc.pipe(res);

        // Add header
        doc.fontSize(28)
           .fillColor('#19021C')
           .text('🕉️ OM SERVICE PRO', { align: 'center' })
           .moveDown(0.5);

        doc.fontSize(16)
           .fillColor('#D4AF37')
           .text('BOOKING CONFIRMATION', { align: 'center' })
           .moveDown(1);

        // Add horizontal line
        doc.strokeColor('#D4AF37')
           .lineWidth(2)
           .moveTo(50, doc.y)
           .lineTo(550, doc.y)
           .stroke()
           .moveDown(1);

        // Booking ID and Status
        doc.fontSize(12)
           .fillColor('#666')
           .text(`Booking ID: #${booking.id.toString().padStart(6, '0')}`, 50, doc.y)
           .text(`Date: ${new Date().toLocaleDateString()}`, 400, doc.y - 15)
           .moveDown(0.5);

        // Status badge
        const statusColors = {
            'Pending': '#FFA500',
            'Done': '#4BB543',
            'Confirmed': '#4BB543',
            'Completed': '#0066CC',
            'Cancelled': '#FF0000'
        };
        
        doc.fontSize(14)
           .fillColor(statusColors[booking.status] || '#666')
           .text(`Status: ${booking.status || 'Pending'}`, { align: 'center' })
           .moveDown(1.5);

        // Customer Information Section
        doc.fontSize(16)
           .fillColor('#19021C')
           .text('Customer Information', 50, doc.y)
           .moveDown(0.5);

        doc.fontSize(11)
           .fillColor('#333');

        const customerInfo = [
            ['Name:', booking.name],
            ['Age:', booking.age || 'N/A'],
            ['Phone:', booking.phone],
            ['Email:', booking.email || 'N/A'],
            ['Address:', booking.address || 'N/A']
        ];

        customerInfo.forEach(([label, value]) => {
            doc.font('Helvetica-Bold').text(label, 70, doc.y, { continued: true, width: 120 })
               .font('Helvetica').text(value, { width: 350 })
               .moveDown(0.3);
        });

        doc.moveDown(1);

        // Service Details Section
        doc.fontSize(16)
           .fillColor('#19021C')
           .text('Service Details', 50, doc.y)
           .moveDown(0.5);

        doc.fontSize(11)
           .fillColor('#333');

        const serviceInfo = [
            ['Service Type:', booking.serviceType],
            ['Service Name:', booking.serviceName],
            ['Event Date:', booking.date]
        ];

        // Add service-specific details
        if (booking.serviceType === 'Catering') {
            serviceInfo.push(
                ['Meal Type:', booking.mealType || 'N/A'],
                ['Number of Guests:', booking.guests || 'N/A'],
                ['Event Duration:', booking.eventDuration || 'N/A']
            );
        } else if (booking.serviceType === 'Travels') {
            serviceInfo.push(
                ['Pickup Location:', booking.pickupLocation || 'N/A'],
                ['Drop Destination:', booking.dropDestination || 'N/A'],
                ['Travel Duration:', booking.travelDuration || 'N/A'],
                ['Passenger Count:', booking.passengerCount || 'N/A']
            );
        } else if (booking.serviceType === 'Photography') {
            serviceInfo.push(
                ['Event Type:', booking.eventType || 'N/A'],
                ['Duration:', booking.photographyDuration || 'N/A']
            );
        } else if (booking.serviceType === 'Sweet Stall') {
            serviceInfo.push(
                ['Quantity:', booking.sweetQuantity || 'N/A'],
                ['Function Time:', booking.functionTime || 'N/A']
            );
        }

        serviceInfo.forEach(([label, value]) => {
            doc.font('Helvetica-Bold').text(label, 70, doc.y, { continued: true, width: 150 })
               .font('Helvetica').text(value, { width: 320 })
               .moveDown(0.3);
        });

        // Add pricing if available
        if (booking.totalAmount) {
            doc.moveDown(1);
            doc.fontSize(14)
               .fillColor('#19021C')
               .text('Payment Information', 50, doc.y)
               .moveDown(0.5);

            doc.fontSize(12)
               .fillColor('#333')
               .font('Helvetica-Bold')
               .text('Total Amount:', 70, doc.y, { continued: true, width: 150 })
               .font('Helvetica')
               .text(`₹${booking.totalAmount}`, { width: 320 });
        }

        // Add notes if available
        if (booking.notes) {
            doc.moveDown(1.5);
            doc.fontSize(14)
               .fillColor('#19021C')
               .text('Additional Notes', 50, doc.y)
               .moveDown(0.5);

            doc.fontSize(11)
               .fillColor('#666')
               .text(booking.notes, 70, doc.y, { width: 470 });
        }

        // Add footer
        doc.moveDown(3);
        doc.strokeColor('#D4AF37')
           .lineWidth(1)
           .moveTo(50, doc.y)
           .lineTo(550, doc.y)
           .stroke()
           .moveDown(0.5);

        doc.fontSize(10)
           .fillColor('#666')
           .text('Thank you for choosing OM Service Pro!', { align: 'center' })
           .moveDown(0.3)
           .text('For any queries, please contact us:', { align: 'center' })
           .moveDown(0.3)
           .fillColor('#19021C')
           .text('📧 contact@omservice.com | 📱 +91 98765 43210', { align: 'center' });

        doc.fontSize(8)
           .fillColor('#999')
           .text(`Generated on ${new Date().toLocaleString()}`, 50, doc.page.height - 50, {
               align: 'center',
               width: 500
           });

        doc.end();

    } catch (error) {
        console.error('PDF generation error:', error);
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: 'Failed to generate PDF',
                error: error.message
            });
        }
    }
};

// Generate Consolidated PDF Report for All Bookings
exports.generateAllBookingsPDF = async (req, res) => {
    try {
        const bookings = await Booking.find().sort({ createdAt: -1 });

        // --- 1. ADVANCED STATISTICS ---
        const totalBookings = bookings.length;
        
        // Fix Revenue Parsing (handle strings like "15,000", "₹1200", etc.)
        const totalRevenue = bookings.reduce((sum, b) => {
            const val = b.totalAmount ? Number(b.totalAmount.toString().replace(/[^0-9.-]+/g,"")) : 0;
            return sum + (isNaN(val) ? 0 : val);
        }, 0);
        
        const serviceStats = {};
        const monthStats = {};
        const customerStats = {};
        const statusStats = {};

        bookings.forEach(b => {
            // Service Stats
            serviceStats[b.serviceType] = (serviceStats[b.serviceType] || 0) + 1;

            // Status Stats
            const status = b.status || 'Pending';
            statusStats[status] = (statusStats[status] || 0) + 1;

            // Monthly Stats (YYYY-MM)
            const d = new Date(b.date || b.createdAt);
            if(!isNaN(d)) {
                const monthKey = d.toLocaleString('default', { month: 'short', year: '2-digit' });
                monthStats[monthKey] = (monthStats[monthKey] || 0) + 1;
            }

            // Customer Stats
            const name = b.name || 'Unknown';
            customerStats[name] = (customerStats[name] || 0) + 1;
        });

        // Top Customers (Sort by count)
        const topCustomers = Object.entries(customerStats)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);

        // --- PDF SETUP ---
        const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
        const filename = `OM_Service_Analytics_${new Date().toISOString().split('T')[0]}.pdf`;

        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/pdf');
        doc.pipe(res);

        // Colors
        const cGold = '#D4AF37';
        const cDark = '#19021C';
        const cCardBg = '#F9F5FF';

        // --- HEADER ---
        doc.rect(0, 0, 842, 80).fill(cDark); // Dark Header Bar
        doc.fontSize(26).fillColor(cGold).text('OM SERVICE PRO', 40, 25, { align: 'left' });
        doc.fontSize(12).fillColor('#fff').text('BUSINESS ANALYTICS REPORT', 40, 55, { align: 'left' });
        doc.fillColor('#ccc').fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, 600, 35, { align: 'right' });

        doc.moveDown(4);

        // --- 2. BUSINESS SNAPSHOT (Filled Cards) ---
        const drawEnhancedCard = (x, label, value, subtext) => {
            // Shadow
            doc.roundedRect(x+2, 102, 180, 80, 8).fill('#e0e0e0');
            // Card Body
            doc.roundedRect(x, 100, 180, 80, 8).fill(cCardBg);
            doc.lineWidth(1).strokeColor(cGold).stroke();
            
            doc.fillColor(cDark).fontSize(10).text(label.toUpperCase(), x + 15, 115);
            doc.fillColor(cGold).fontSize(24).font('Helvetica-Bold').text(value, x + 15, 135);
            if(subtext) doc.fillColor('#666').fontSize(9).font('Helvetica').text(subtext, x + 15, 165);
        };

        const topService = Object.keys(serviceStats).reduce((a, b) => serviceStats[a] > serviceStats[b] ? a : b, '-');

        drawEnhancedCard(40, 'Total Revenue', `₹${totalRevenue.toLocaleString()}`, 'Gross Income');
        drawEnhancedCard(240, 'Total Bookings', totalBookings, `${Object.keys(customerStats).length} Unique Customers`);
        drawEnhancedCard(440, 'Top Service', topService, `${serviceStats[topService] || 0} Orders`);
        drawEnhancedCard(640, 'Conversion Rate', `${Math.round(((statusStats['Done']||0)/totalBookings || 0)*100)}%`, 'Completed Orders');

        // --- 3. CHARTS ROW ---
        const chartY = 230;
        
        // A. Service Distribution (Donut Chart)
        doc.fillColor(cDark).font('Helvetica-Bold').fontSize(14).text('SERVICE MIX', 100, chartY);
        
        const chartColors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'];
        let startAngle = 0;
        const donutX = 150, donutY = chartY + 90, radius = 60;
        const totalSvens = Object.values(serviceStats).reduce((a,b)=>a+b,0);
        
        Object.entries(serviceStats).forEach(([label, count], i) => {
            const slice = (count/totalSvens) * 2 * Math.PI;
            const end = startAngle + slice;
            doc.save();
            doc.path(`M ${donutX} ${donutY} L ${donutX + radius * Math.cos(startAngle)} ${donutY + radius * Math.sin(startAngle)} A ${radius} ${radius} 0 ${slice > Math.PI ? 1 : 0} 1 ${donutX + radius * Math.cos(end)} ${donutY + radius * Math.sin(end)} L ${donutX} ${donutY} Z`)
               .fill(chartColors[i % chartColors.length]);
            doc.restore();
            startAngle = end;

            // Legend
            doc.rect(230, chartY + 40 + (i*20), 10, 10).fill(chartColors[i % chartColors.length]);
            doc.fillColor('#333').fontSize(10).text(`${label} (${count})`, 250, chartY + 40 + (i*20));
        });
        // Donut Hole
        doc.circle(donutX, donutY, 30).fill('white');

        // B. Monthly Trends (Bar Chart)
        doc.fillColor(cDark).font('Helvetica-Bold').fontSize(14).text('MONTHLY BOOKING TRENDS', 450, chartY);
        
        const barX = 450, barY = chartY + 140, barW = 30, maxBarH = 100;
        const months = Object.keys(monthStats).slice(-6); // Last 6 months
        const maxVal = Math.max(...Object.values(monthStats)) || 1;
        
        months.forEach((m, i) => {
            const val = monthStats[m];
            const h = (val / maxVal) * maxBarH;
            
            // Bar
            doc.rect(barX + (i * 50), barY - h, barW, h).fill(cGold);
            // Label
            doc.fillColor('#333').fontSize(9).text(m, barX + (i * 50), barY + 10, { width: barW, align: 'center' });
            // Value
            doc.fillColor('#000').fontSize(8).text(val, barX + (i * 50), barY - h - 10, { width: barW, align: 'center' });
        });
        // Axis Line
        doc.lineWidth(1).strokeColor('#ccc').moveTo(barX, barY).lineTo(barX + 300, barY).stroke();

        
        // --- 4. TOP CUSTOMERS ---
        const custY = chartY;
        const summaryY = 420;
        
        // --- INSIGHTS SECTION ---
        doc.roundedRect(40, summaryY, 350, 100, 5).fill('#f0f0f0');
        doc.fillColor(cDark).fontSize(12).font('Helvetica-Bold').text('💡 AI INSIGHTS', 55, summaryY + 15);
        doc.fillColor('#444').fontSize(10).font('Helvetica')
           .text(`• ${topService} is your leading service with ${serviceStats[topService]} bookings.`, 55, summaryY + 35)
           .text(`• You have retained ${Object.keys(customerStats).length} unique customers.`, 55, summaryY + 50)
           .text(`• Current completion rate is ${Math.round(((statusStats['Done']||0)/totalBookings || 0)*100)}%.`, 55, summaryY + 65);

        // --- TOP CUSTOMERS TABLE ---
        doc.fillColor(cDark).fontSize(12).font('Helvetica-Bold').text('🏆 TOP CUSTOMERS', 450, summaryY);
        let cy = summaryY + 20;
        doc.font('Helvetica').fontSize(10);
        topCustomers.forEach(([name, count], i) => {
            doc.rect(450, cy, 300, 15).fill(i%2===0 ? '#fff' : '#f9f9f9');
            doc.fillColor('#333').text(`${i+1}. ${name}`, 460, cy + 3);
            doc.fillColor(cGold).font('Helvetica-Bold').text(`${count} Bookings`, 700, cy + 3);
            doc.font('Helvetica');
            cy += 18;
        });

        // --- 5. DETAILED LOG (New Page) ---
        doc.addPage({ layout: 'landscape', margin: 30 });
        doc.fontSize(16).fillColor(cDark).text('DETAILED BOOKING LEDGER', 30, 30);
        
        const tableTop = 60;
        const colWidths = [70, 60, 100, 30, 70, 120, 100, 50, 60, 80]; 
        const headers = ['ID', 'Date', 'Customer', 'Age', 'Phone', 'Email', 'Service', 'Amt', 'Status', 'Location'];
        
        let currentY = tableTop;

        const drawHeader = (y) => {
            doc.rect(30, y, 780, 20).fill(cDark); // Dark Header
            doc.fillColor(cGold).font('Helvetica-Bold').fontSize(9);
            let cx = 35;
            headers.forEach((h, i) => {
                doc.text(h, cx, y + 6, { width: colWidths[i], ellipsis: true });
                cx += colWidths[i];
            });
        };

        drawHeader(currentY);
        currentY += 20;

        doc.font('Helvetica').fontSize(8);

        bookings.forEach((b, i) => {
            if (currentY > 550) {
                doc.addPage({ layout: 'landscape', margin: 30 });
                currentY = 30;
                drawHeader(currentY);
                currentY += 20;
            }

            if (i % 2 === 0) doc.rect(30, currentY, 780, 18).fill('#f4f4f4');

            doc.fillColor('#333');
            let cx = 35;
            const amt = b.totalAmount ? `₹${Number(b.totalAmount.toString().replace(/[^0-9.-]+/g,"")).toLocaleString()}` : '-';

            const row = [
                b._id.toString().slice(-6).toUpperCase(),
                b.date || '-',
                b.name || 'Guest',
                b.age || '-',
                b.phone || '-',
                b.email || '-',
                b.serviceType,
                amt,
                b.status || 'Pending',
                b.address ? b.address.substring(0, 15) + '...' : '-'
            ];

            row.forEach((cell, idx) => {
                doc.text(String(cell), cx, currentY + 5, { width: colWidths[idx], ellipsis: true });
                cx += colWidths[idx];
            });
            
            currentY += 18;
        });

        // Footer
        const footerY = 570;
        doc.rect(0, footerY, 842, 25).fill(cDark);
        doc.fillColor('#fff').fontSize(8).text('© 2026 OM SERVICE PRO | Confidential Business Report', 40, footerY + 8);

        doc.end();

    } catch (error) {
        console.error('Report Error:', error);
        res.status(500).send('Error generating report');
    }
};
