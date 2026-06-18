/**
 * Local Business Marketplace - Booking System Utilities
 */
window.Booking = {
  generateTimeSlots: function() {
    return ['9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM'];
  },
  isSlotAvailable: function(businessId, date, time) {
    const bookings = Store.getBookings({ businessId });
    return !bookings.some(b => b.bookingDate === date && b.time === time && (b.status === 'confirmed' || b.status === 'pending'));
  },
  getTodayStr: function() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
};
