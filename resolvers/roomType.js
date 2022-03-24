module.exports = {
  Query: {
    ch_roomTypes: (root, { pagination }, { dataSources }) =>
      dataSources.channexAPI.getRoomTypes(pagination),
    ch_roomTypesByPropertyId: (
      root,
      { propertyId, pagination },
      { dataSources }
    ) =>
      dataSources.channexAPI.getRoomTypes(pagination, {
        property_id: propertyId,
      }),
    ch_roomType: (root, { roomTypeId }, { dataSources }) =>
      dataSources.channexAPI.getRoomType(roomTypeId),
  },
  Mutation: {
    ch_createRoomType: (root, { roomType }, { dataSources }) =>
      dataSources.channexAPI.createRoomType(roomType),
    ch_updateRoomType: (root, { roomType }, { dataSources }) =>
      dataSources.channexAPI.updateRoomType(roomType),
    ch_deleteRoomType: (root, { roomTypeId }, { dataSources }) =>
      dataSources.channexAPI.deleteRoomType(roomTypeId),
  },
  RoomType: {
    property: (root, args, { dataSources }) => {
      const propertyId = root.relationships?.property?.data?.id
      if (propertyId) return dataSources.channexAPI.getProperty(propertyId)
      else return null
    },
  },
}
