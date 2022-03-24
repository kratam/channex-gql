module.exports = {
  Query: {
    ch_hotelPolicy: (root, { hotelPolicyId }, { dataSources }) =>
      dataSources.channexAPI.getHotelPolicy(hotelPolicyId),
    ch_hotelPolicies: (root, { pagination }, { dataSources }) =>
      dataSources.channexAPI.getHotelPolicies(pagination),
  },
  Mutation: {
    ch_createHotelPolicy: (root, { hotelPolicy }, { dataSources }) =>
      dataSources.channexAPI.createHotelPolicy(hotelPolicy),
    ch_updateHotelPolicy: (root, { hotelPolicy }, { dataSources }) =>
      dataSources.channexAPI.updateHotelPolicy(hotelPolicy),
    ch_deleteHotelPolicy: (root, { hotelPolicyId }, { dataSources }) =>
      dataSources.channexAPI.deleteHotelPolicy(hotelPolicyId),
  },
}
