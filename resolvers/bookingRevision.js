module.exports = {
  Query: {
    ch_bookingRevisions: (root, { pagination, filter }, { dataSources }) =>
      dataSources.channexAPI.getBookingRevisions(pagination, filter),
    ch_bookingRevisionsFeed: (root, { pagination, filter }, { dataSources }) =>
      dataSources.channexAPI.getBookingRevisionsFeed(pagination, filter),
    ch_bookingRevision: (root, { bookingRevisionId }, { dataSources }) =>
      dataSources.channexAPI.getBookingRevision(bookingRevisionId),
    ch_booking: (root, { bookingId }, { dataSources }) =>
      dataSources.channexAPI.getBooking(bookingId),
    ch_bookings: (root, { pagination, filter, order }, { dataSources }) =>
      dataSources.channexAPI.getBookings({ pagination, filter, order }),
  },
  Mutation: {
    ch_ackBookingRevision: (root, { bookingRevisionId }, { dataSources }) =>
      dataSources.channexAPI.ackBookingRevision(bookingRevisionId),
    ch_createBooking: (root, { booking }, { dataSources }) =>
      dataSources.channexAPI.createBooking(booking),
  },
  BookingRevision: {
    property: ({ attributes: { property_id } }, args, { dataSources }) =>
      dataSources.channexAPI.getProperty(property_id),
    booking: ({ attributes: { booking_id } }, args, { dataSources }) =>
      dataSources.channexAPI.getBooking(booking_id),
  },
  Booking: {
    property: ({ attributes: { property_id } }, args, { dataSources }) =>
      dataSources.channexAPI.getProperty(property_id),
    message_thread: (
      {
        relationships: {
          message_thread: { data: { id: threadId = null } = {} } = {},
        },
      },
      args,
      { dataSources },
    ) => threadId && dataSources.channexAPI.messageThread(threadId),
  },
  BookingRoom: {
    rate_plan: ({ rate_plan_id }, args, { dataSources }) =>
      dataSources.channexAPI.getRatePlan(rate_plan_id),
    room_type: ({ room_type_id }, args, { dataSources }) =>
      dataSources.channexAPI.getRoomType(room_type_id),
  },
  CreateBookingResponseData: {
    booking_revision: ({ revision_id }, args, { dataSources }) =>
      dataSources.channexAPI.getBookingRevision(revision_id),
  },
};
