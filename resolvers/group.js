module.exports = {
  Mutation: {
    ch_createGroup: (root, { group }, { dataSources }) =>
      dataSources.channexAPI.createGroup(group),
    ch_updateGroup: (root, { group }, { dataSources }) =>
      dataSources.channexAPI.updateGroup(group),
    ch_deleteGroup: (root, { groupId }, { dataSources }) =>
      dataSources.channexAPI.deleteGroup(groupId),
    ch_addPropertyToGroup: (root, { groupId, propertyId }, { dataSources }) =>
      dataSources.channexAPI.addPropertyToGroup(groupId, propertyId),
    ch_removePropertyFromGroup: (root, { groupId, propertyId }, { dataSources }) =>
      dataSources.channexAPI.removePropertyFromGroup(groupId, propertyId),
  },
  Query: {
    ch_groups: (root, { pagination }, { dataSources }) =>
      dataSources.channexAPI.getGroups(pagination),
    ch_group: (root, { groupId }, { dataSources }) =>
      dataSources.channexAPI.getGroup(groupId),
  },
  Group: {
    properties: ({ id }, args, { dataSources }) =>
      dataSources.channexAPI.getPropertiesByGroupId(id),
  },
}
