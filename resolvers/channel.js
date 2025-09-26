module.exports = {
  ChannelSettings: {
    __resolveType: (obj) => {
      if (obj.min_stay_type && obj.tokens) return "AirbnbSettings";
      if (obj.hotel_id && obj.machine_account) return "BookingComSettings";
      // will throw error
      return null;
    },
  },
  ChannelRatePlanSettings: {
    __resolveType: (obj) => {
      if (obj.listing_id && obj.listing_type && obj.availability_rule)
        return "AirbnbRatePlanSettings";
      // will throw error
      return null;
    },
  },
};
