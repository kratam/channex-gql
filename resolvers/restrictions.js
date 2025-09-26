module.exports = {
  Mutation: {
    ch_updateRestrictions: (root, { values }, { dataSources }) =>
      dataSources.channexAPI.updateRestrictions(values),
  },
  Query: {
    ch_restrictions: (root, { filter }, { dataSources }) =>
      dataSources.channexAPI.getRestrictions(filter),
  },
  Restriction: {
    rate_plan: ({ rate_plan_id }, args, { dataSources }) =>
      dataSources.channexAPI.getRatePlan(rate_plan_id),
  },
};
