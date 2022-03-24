module.exports = {
  Query: {
    ch_messagesByThread: (
      root,
      { threadId, pagination, order },
      { dataSources }
    ) => dataSources.channexAPI.messagesByThread(threadId, pagination, order),
    ch_messagesByBooking: (
      root,
      { bookingId, pagination, order },
      { dataSources }
    ) => dataSources.channexAPI.messagesByBooking(bookingId, pagination, order),
    ch_messageThreads: (root, { pagination, filter, order }, { dataSources }) =>
      dataSources.channexAPI.messageThreads(pagination, filter, order),
    ch_messageThread: (root, { threadId }, { dataSources }) =>
      dataSources.channexAPI.messageThread(threadId),
  },
  Mutation: {
    ch_sendMessageToBooking: (root, { message, bookingId }, { dataSources }) =>
      dataSources.channexAPI.sendMessageToBooking(message, bookingId),
    ch_sendMessageToThread: (root, { message, threadId }, { dataSources }) =>
      dataSources.channexAPI.sendMessageToThread(message, threadId),
    ch_closeMessageThread: (root, { threadId }, { dataSources }) =>
      dataSources.channexAPI.closeMessageThread(threadId),
    ch_openMessageThread: (root, { threadId }, { dataSources }) =>
      dataSources.channexAPI.openMessageThread(threadId),
  },
  MessageThread: {
    messages: ({ id }, args, { dataSources }) =>
      dataSources.channexAPI.messagesByThread(id),
    booking: (
      {
        relationships: {
          booking: { data: { id: bookingId = null } = {} } = {},
        },
      },
      args,
      { dataSources }
    ) => bookingId && dataSources.channexAPI.getBooking(bookingId),
  },
}
