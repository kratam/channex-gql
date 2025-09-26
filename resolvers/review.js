module.exports = {
  Query: {
    ch_reviews: (root, { pagination, filter, order }, { dataSources }) =>
      dataSources.channexAPI.getReviews(pagination, filter, order),
    ch_review: (root, { reviewId }, { dataSources }) =>
      dataSources.channexAPI.getReview(reviewId),
  },
  Mutation: {
    ch_sendAirbnbReview: (root, { reviewId, review }, { dataSources }) =>
      dataSources.channexAPI.sendAirbnbReview(reviewId, review),
    ch_replyReview: (root, { reviewId, reply }, { dataSources }) =>
      dataSources.channexAPI.replyReview(reviewId, reply),
  },
  Review: {
    property: (root, args, { dataSources }) => {
      const propertyId = root.relationships?.property?.data?.id;
      if (propertyId) return dataSources.channexAPI.getProperty(propertyId);
      else return null;
    },
    booking: (root, args, { dataSources }) => {
      const bookingId = root.relationships?.booking?.data?.id;
      if (bookingId) return dataSources.channexAPI.getBooking(bookingId);
      else return null;
    },
  },
};
