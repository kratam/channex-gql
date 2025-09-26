module.exports = {
  Query: {
    ch_properties: (root, { pagination }, { dataSources }) =>
      dataSources.channexAPI.getProperties(pagination),
    ch_propertyOptions: (root, args, { dataSources }) =>
      dataSources.channexAPI.getPropertyOptions(),
    ch_property: (root, { propertyId }, { dataSources }) =>
      dataSources.channexAPI.getProperty(propertyId),
  },
  Mutation: {
    ch_createProperty: (root, { property }, { dataSources }) =>
      dataSources.channexAPI.createProperty(property),
    ch_updateProperty: (root, { property }, { dataSources }) =>
      dataSources.channexAPI.updateProperty(property),
    ch_deleteProperty: (root, { propertyId }, { dataSources }) =>
      dataSources.channexAPI.deleteProperty(propertyId),
  },
};
