module.exports = {
  Query: {
    ch_ratePlans: (root, { pagination, filter }, { dataSources }) =>
      dataSources.channexAPI.getRatePlans(pagination, filter),
    ch_ratePlan: (root, { ratePlanId }, { dataSources }) =>
      dataSources.channexAPI.getRatePlan(ratePlanId),
  },
  Mutation: {
    ch_createRatePlan: (root, { ratePlan }, { dataSources }) =>
      dataSources.channexAPI.createRatePlan(ratePlan),
    ch_updateRatePlan: (root, { ratePlan }, { dataSources }) =>
      dataSources.channexAPI.updateRatePlan(ratePlan),
    ch_deleteRatePlan: (root, { ratePlanId }, { dataSources }) =>
      dataSources.channexAPI.deleteRatePlan(ratePlanId),
  },
  RatePlan: {
    property: (root, args, { dataSources }) => {
      const propertyId = root.relationships?.property?.data?.id;
      if (propertyId) return dataSources.channexAPI.getProperty(propertyId);
      else return null;
    },
  },
};
