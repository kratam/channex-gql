/* eslint-disable no-underscore-dangle */
// const fs = require('fs')
// const path = require('path')
const { RESTDataSource } = require("apollo-datasource-rest");
const ono = require("@jsdevtools/ono");
const qs = require("qs");
const cloneDeepWith = require("lodash.clonedeepwith");
const set = require("lodash.set");
// const { logger: defaultLogger } = require('../utils/logger')

/**
 * reply.reply should be a text but sometimes it's null
 */
const fixNullReply = (review) => {
  if (review?.attributes?.reply && !review.attributes.reply.reply)
    review.attributes.reply = null;
  return review;
};

const filterByRelations = (relation, id) => (item) =>
  item.relationships?.[relation]?.data.find((r) => r.id === id);

/**
 * channex sends dates as 2021-10-18T09:33:21.410938,
 * missing a Z from the end.
 * We also want to convert "string-floats" to int, e.g. "1.00" => 100
 */
const dateFixRe = /20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d.\d\d\d\d\d\d$/;
const numberStringsFixRe = /^\d*\.\d\d$/;
const fixValues = (value) => {
  if (typeof value === "string" && dateFixRe.test(value)) return `${value}Z`;
  if (typeof value === "string" && numberStringsFixRe.test(value))
    return Math.round(Number(value) * 100);

  // returning undefined keeps the original value
  return undefined;
};

/**
 * Certain fields can be sent as an Int or as [Int] with 7 values
 * for the 7 days of the week. Allow the user to send [true] and
 * expand change it to true (without the array)
 * @param {*} value
 * @param {*} key
 */
const fixWeekdayValues = (value, key) => {
  const fieldNames = [
    "closed_to_arrival",
    "closed_to_departure",
    "max_stay",
    "min_stay_arrival",
    "min_stay_through",
    "stop_sell",
  ];
  if (fieldNames.includes(key) && Array.isArray(value) && value.length === 1)
    return [
      value[0],
      value[0],
      value[0],
      value[0],
      value[0],
      value[0],
      value[0],
    ];
  // returning undefined for the original value
  return undefined;
};

const transformBookingRoomsDays = (rooms) =>
  rooms.map((room) => ({
    ...room,
    days: room.days
      ? Object.keys(room.days).map((date) => ({
          date,
          amount: room.days[date],
        }))
      : room.days,
  }));

const parseBookingRawMessage = (booking, logger) => {
  if (booking?.attributes?.raw_message) {
    try {
      // eslint-disable-next-line no-param-reassign
      booking.attributes.raw_message = JSON.parse(
        booking.attributes.raw_message,
      );
    } catch (error) {
      logger.error(
        "CHANNEX_DS: unabe to parse raw_message",
        booking.attributes.raw_message,
      );
      // make sure we return JSONObject
      // eslint-disable-next-line no-param-reassign
      booking.attributes.raw_message = { raw: booking.attributes.raw_message };
    }
  } else {
    logger.warn("no raw_message", { booking });
  }
};

const fixFilter = (filter) => {
  if (filter.date_lte && filter.date_gte) {
    set(filter, "date.lte", filter.date_lte);
    set(filter, "date.gte", filter.date_gte);
  }
  // eslint-disable-next-line no-param-reassign
  delete filter.date_lte;
  // eslint-disable-next-line no-param-reassign
  delete filter.date_gte;
};

class ChannexAPI extends RESTDataSource {
  constructor({
    baseURL = "https://app.channex.io/api/v1",
    logger = console,
  } = {}) {
    super();
    this.baseURL = baseURL;
    this.logger = logger;
  }

  async didReceiveResponse(response) {
    if (response.ok) {
      const parsed = await this.parseBody(response);
      const fixed = cloneDeepWith(parsed, fixValues);
      // this.logger.silly(`channex response`, { converted })
      return fixed;
    }
    const error = await this.errorFromResponse(response);
    throw error;
  }

  // eslint-disable-next-line class-methods-use-this
  async willSendRequest(request) {
    const apiKey = this.context.CHANNEX_API_KEY || process.env.CHANNEX_API_KEY;
    request.headers.set("user-api-key", apiKey);
    if (request.body)
      request.body = cloneDeepWith(request.body, fixWeekdayValues);
    // fs.writeFileSync(
    //   path.join(__dirname, `log-request.txt`),
    //   JSON.stringify(request, null, '  '),
    //   { flag: 'a+' }
    // )
    // fs.writeFileSync(path.join(__dirname, `log-request.txt`), '\n\n', {
    //   flag: 'a+',
    // })
    // this.logger.dir(request)
    return request;
  }

  /**
   * Generic method for paginated/filtered lists
   * @param {string} url url, e.g. users/all
   * @param {{page: number, limit: number}} pagination
   * @param {*} filter filter object
   * @returns {Promise} fetch request promise..
   */
  _makeListMethod(
    url,
    { page = 1, limit = 100 } = {},
    filter,
    order,
    rest = {},
  ) {
    const paramsObj = {
      pagination: { page, limit },
      ...(filter ? { filter: filter.object } : {}),
      ...(order ? { order: order.object } : {}),
      ...rest,
    };
    const params = qs.stringify(paramsObj, { encode: false });
    const fullUrl = `${url}/?${params}`;
    return this.get(fullUrl);
  }

  getHotelPolicy(hotelPolicyId) {
    return this.get(`hotel_policies/${hotelPolicyId}`);
  }

  getHotelPolicies(pagination) {
    return this._makeListMethod(`hotel_policies`, pagination);
  }

  createHotelPolicy({ ...hotelPolicy }) {
    return this.post(`hotel_policies`, { hotel_policy: hotelPolicy });
  }

  updateHotelPolicy({ id, ...hotelPolicy }) {
    return this.put(`hotel_policies/${id}`, { hotel_policy: hotelPolicy });
  }

  deleteHotelPolicy(hotelPolicyId) {
    return this.delete(`hotel_policies/${hotelPolicyId}`);
  }

  createBooking(booking) {
    /**
     * Change rooms[].days[] back to object
     */
    const transformBooking = ({ rooms, ...rest }) => ({
      ...rest,
      rooms: rooms.map(({ days, ...room }) => ({
        ...room,
        days: days.reduce(
          (cum, day) => ({ ...cum, [day.date]: day.amount }),
          {},
        ),
      })),
    });

    return this.post(`bookings/push`, { booking: transformBooking(booking) });
  }

  ackBookingRevision(bookingRevisionId) {
    return this.post(`booking_revisions/${bookingRevisionId}/ack`);
  }

  async getBookingRevision(bookingRevisionId) {
    const response = await this.get(`booking_revisions/${bookingRevisionId}`);
    if (response?.data?.attributes?.rooms)
      response.data.attributes.rooms = transformBookingRoomsDays(
        response.data.attributes.rooms,
      );
    parseBookingRawMessage(response?.data, this.logger);
    return response;
  }

  async getBooking(bookingId) {
    const response = await this.get(`bookings/${bookingId}?relationships=all`);
    if (response?.data?.attributes?.rooms)
      response.data.attributes.rooms = transformBookingRoomsDays(
        response.data.attributes.rooms,
      );
    parseBookingRawMessage(response?.data, this.logger);
    return response;
  }

  async getBookings({ pagination, filter, order }) {
    const response = await this._makeListMethod(
      `bookings`,
      pagination,
      filter,
      order,
    );
    if (response?.data && Array.isArray(response.data)) {
      response.data = response.data.map((booking) => {
        if (booking.attributes?.rooms) {
          // eslint-disable-next-line no-param-reassign
          booking.attributes.rooms = transformBookingRoomsDays(
            booking.attributes.rooms,
          );
        }
        parseBookingRawMessage(booking, this.logger);
        return booking;
      });
    }
    return response;
  }

  async getBookingRevisions(pagination, filter) {
    const response = await this._makeListMethod(
      `booking_revisions`,
      pagination,
      filter,
    );
    if (response?.data && Array.isArray(response.data)) {
      response.data = response.data.map((booking) => {
        if (booking.attributes?.rooms) {
          // eslint-disable-next-line no-param-reassign
          booking.attributes.rooms = transformBookingRoomsDays(
            booking.attributes.rooms,
          );
        }
        parseBookingRawMessage(booking, this.logger);
        return booking;
      });
    }
    return response;
  }

  async getBookingRevisionsFeed(pagination, filter) {
    const response = await this._makeListMethod(
      `booking_revisions/feed`,
      pagination,
      filter,
    );
    if (response.data && Array.isArray(response.data)) {
      response.data = response.data.map((booking) => {
        if (booking.attributes?.rooms) {
          // eslint-disable-next-line no-param-reassign
          booking.attributes.rooms = transformBookingRoomsDays(
            booking.attributes.rooms,
          );
        }
        parseBookingRawMessage(booking, this.logger);
        return booking;
      });
    }
    return response;
  }

  messagesByThread(threadId, pagination, order) {
    if (!threadId) throw ono({ message: "threadId cannot be empty" });
    return this._makeListMethod(
      `message_threads/${threadId}/messages`,
      pagination,
      null,
      order,
      { system_events: true },
    );
  }

  messagesByBooking(bookingId, pagination, order) {
    return this._makeListMethod(
      `bookings/${bookingId}/messages`,
      pagination,
      null,
      order,
    );
  }

  messageThreads(pagination, filter, order) {
    return this._makeListMethod(`message_threads`, pagination, filter, order);
  }

  messageThread(threadId) {
    // TODO: handle when threadId is null. It can happen
    // if we call this from a relationship and the parent object (e.g a booking)
    // doesn't have a thread
    return this.get(`message_threads/${threadId}`);
  }

  sendMessageToBooking(message, bookingId) {
    return this.post(`bookings/${bookingId}/messages`, { message });
  }

  sendMessageToThread(message, threadId) {
    return this.post(`message_threads/${threadId}/messages`, { message });
  }

  closeMessageThread(threadId) {
    return this.post(`message_threads/${threadId}/close`);
  }

  openMessageThread(threadId) {
    return this.post(`message_threads/${threadId}/open`);
  }

  updateAvailability(values) {
    return this.post(`availability`, { values });
  }

  async getAvailability(filter) {
    fixFilter(filter);

    const transformResponse = ({ data, ...response }) => {
      if (!data) return response;
      return {
        ...response,
        data: Object.keys(data).flatMap((room_type_id) =>
          Object.keys(data[room_type_id]).map((date) => ({
            room_type_id,
            date,
            availability: data[room_type_id][date],
          })),
        ),
      };
    };

    const params = qs.stringify({ filter }, { encode: false });

    const response = await this.get(`availability?${params}`);
    return transformResponse(response);
  }

  updateRestrictions(values) {
    return this.post(`restrictions`, { values });
  }

  async getRestrictions(filter) {
    fixFilter(filter);

    const transformResponse = ({ data, ...response }) => {
      if (!data) return response;
      return {
        ...response,
        data: Object.keys(data).flatMap((rate_plan_id) =>
          Object.keys(data[rate_plan_id]).map((date) => ({
            rate_plan_id,
            date,
            ...data[rate_plan_id][date],
          })),
        ),
      };
    };

    const params = qs.stringify({ filter }, { encode: false });
    const response = await this.get(`restrictions?${params}`);
    return transformResponse(response);
  }

  getFacilities() {
    return this.get(`facilities/options`);
  }

  async createRatePlan({ ...ratePlan }) {
    let attempt = 0;
    const maxAttempts = 3;
    const originalTitle = ratePlan.title;

    while (attempt < maxAttempts) {
      try {
        // Modify title for retry attempts
        if (attempt > 0) {
          ratePlan.title = `${originalTitle} (${attempt + 1})`;
        }

        const result = await this.post(`rate_plans`, { rate_plan: ratePlan });

        // If successful, return the result
        return result;
      } catch (error) {
        // Check if it's a duplicate title error
        if (
          error.extensions?.response?.body?.errors?.code ===
            "validation_error" &&
          error.extensions?.response?.body?.errors?.details?.title &&
          error.extensions?.response?.body?.errors?.details?.title.some((msg) =>
            msg.includes("Duplication in Rate Plan title is not allowed"),
          )
        ) {
          attempt++;
          if (attempt >= maxAttempts) {
            // If we've exhausted all attempts, throw the error with modified message
            throw ono({
              ...error,
              message: `Unable to create rate plan after ${maxAttempts} attempts. All names from "${originalTitle}" to "${originalTitle} (${maxAttempts})" are already in use.`,
            });
          }
          // Continue to next attempt with modified name
          this.logger.warn(
            `Rate plan title "${ratePlan.title}" already exists, trying "${originalTitle} (${attempt + 1})"...`,
          );
        } else {
          // If it's not a duplicate title error, throw it
          throw error;
        }
      }
    }
  }

  updateRatePlan({ id, ...ratePlan }) {
    return this.put(`rate_plans/${id}`, { rate_plan: ratePlan });
  }

  deleteRatePlan(ratePlanId) {
    return this.delete(`rate_plans/${ratePlanId}`);
  }

  getRatePlans(pagination, filter) {
    return this._makeListMethod(`rate_plans`, pagination, filter);
  }

  getRatePlan(ratePlanId) {
    return this.get(`rate_plans/${ratePlanId}`);
  }

  async getReviews(pagination, filter, order) {
    const result = await this._makeListMethod(
      `reviews`,
      pagination,
      filter,
      order,
    );
    result.data = result.data.map(fixNullReply);
    return result;
  }

  async getReview(reviewId) {
    const result = await this.get(`reviews/${reviewId}`);
    result.data = fixNullReply(result.data);
    return result;
  }

  sendAirbnbReview(reviewId, review) {
    return this.post(`reviews/${reviewId}/guest_review`, { review });
  }

  async replyReview(reviewId, reply) {
    try {
      await this.post(`reviews/${reviewId}/reply`, {
        reply: { reply },
      });
      return { success: true };
    } catch (error) {
      throw error;
    }
  }

  getProperties(pagination, filter) {
    return this._makeListMethod(`properties`, pagination, filter);
  }

  getPropertyOptions() {
    return this.get(`properties/options`);
  }

  getProperty(propertyId) {
    return this.get(`properties/${propertyId}`);
  }

  createProperty({ ...property }) {
    return this.post(`properties`, { property });
  }

  updateProperty({ id, ...property }) {
    return this.put(`properties/${id}`, { property });
  }

  deleteProperty(propertyId) {
    return this.delete(`properties/${propertyId}`);
  }

  async getPropertiesByGroupId(groupId, pagination) {
    // TODO: get next page if has more
    const properties = await this.getProperties(pagination);
    properties.data = properties.data.filter(
      filterByRelations("groups", groupId),
    );
    return properties;
  }

  getRoomTypes(pagination, filter) {
    return this._makeListMethod(`room_types`, pagination, filter);
  }

  getRoomType(roomTypeId) {
    return this.get(`room_types/${roomTypeId}`);
  }

  createRoomType({ ...roomType }) {
    return this.post(`room_types`, { room_type: roomType });
  }

  deleteRoomType(roomTypeId) {
    return this.delete(`room_types/${roomTypeId}`);
  }

  updateRoomType({ id, ...roomType }) {
    return this.put(`room_types/${id}`, { room_type: roomType });
  }

  createSubscription(subscription) {
    return this.post(`subscriptions`, { subscription });
  }

  updateSubscription(subscriptionId, subscription) {
    return this.put(`subscriptions/${subscriptionId}`, { subscription });
  }

  getSubscription(subscriptionId) {
    return this.get(`subscriptions/${subscriptionId}`);
  }

  getSubscriptions(pagination) {
    return this._makeListMethod(`subscriptions`, pagination);
  }

  getGroups(pagination, filter) {
    return this._makeListMethod(`groups`, pagination, filter);
  }

  getGroup(groupId) {
    return this.get(`groups/${groupId}`);
  }

  createGroup({ ...group }) {
    return this.post(`groups`, { group });
  }

  updateGroup({ id, ...group }) {
    return this.put(`groups/${id}`, { group });
  }

  deleteGroup(groupId) {
    return this.delete(`groups/${groupId}`);
  }

  addPropertyToGroup(groupId, propertyId) {
    return this.post(`groups/${groupId}/properties/${propertyId}`);
  }

  removePropertyFromGroup(groupId, propertyId) {
    return this.delete(`groups/${groupId}/properties/${propertyId}`);
  }
}

module.exports = { ChannexAPI };
