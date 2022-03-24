module.exports = {
  Mutation: {
    ch_updateAvailabilities: (root, { values }, { dataSources }) =>
      dataSources.channexAPI.updateAvailability(values),
  },

  Query: {
    ch_availabilities: (root, { filter }, { dataSources }) =>
      dataSources.channexAPI.getAvailability(filter),
  },

  Availability: {
    room_type: ({ room_type_id }, args, { dataSources }) =>
      dataSources.channexAPI.getRoomType(room_type_id),
  },
}
