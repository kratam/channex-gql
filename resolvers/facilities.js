module.exports = {
  Query: {
    ch_facilities: (root, args, { dataSources }) =>
      dataSources.channexAPI.getFacilities(),
  },
};
