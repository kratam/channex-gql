module.exports = {
  Query: {
    ch_subscriptions: (root, { pagination }, { dataSources }) =>
      dataSources.channexAPI.getSubscriptions(pagination),
    ch_subscription: (root, { subscriptionId }, { dataSources }) =>
      dataSources.channexAPI.getSubscription(subscriptionId),
  },
  Mutation: {
    ch_createSubscription: (root, { subscription }, { dataSources }) =>
      dataSources.channexAPI.createSubscription(subscription),
    ch_updateSubscription: (
      root,
      { subscriptionId, subscription },
      { dataSources },
    ) =>
      dataSources.channexAPI.createSubscription(subscriptionId, subscription),
  },
  Subscription: {
    property: (
      {
        relationships: {
          property: { data: { id: propertyId = null } = {} } = {},
        },
      },
      args,
      { dataSources },
    ) => propertyId && dataSources.channexAPI.getProperty(propertyId),
  },
};
