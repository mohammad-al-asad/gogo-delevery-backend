import { Types } from "mongoose";
import { apiError } from "../../errors/api-error";
import { Errors } from "../../constants/error-codes";
import { OrderRepository } from "./order.repository";
import { UserRepository } from "../user/user.repository";
import { CommonRepository } from "../common/common.repository";

const REFERRAL_FIRST_ORDER_DISCOUNT = 10;
const KM_TO_MILES = 0.621371;
const ORDER_PRICE_CURRENCY = "KWD";

const VALID_TRANSITIONS: Record<string, string[]> = {
  Pending: ["Accepted", "Cancelled"],
  Accepted: ["ArrivedPickup", "Cancelled"],
  ArrivedPickup: ["InProgress", "Cancelled"],
  InProgress: ["Completed", "Cancelled"],
  Completed: [],
  Cancelled: [],
};

export class OrderService {
  constructor(
    private orderRepo: OrderRepository,
    private userRepo: UserRepository,
    private commonRepo: CommonRepository
  ) {}

  private getActorId = (actor: any) =>
    actor ? String(actor._id || actor) : null;

  private buildStatusHistoryEntry = (
    currentUser: any,
    status: string,
    note?: string
  ) => ({
    status,
    changedAt: new Date(),
    changedBy: currentUser?.userId || null,
    actorRole: currentUser?.role || "Admin",
    ...(note ? { note } : {}),
  });

  createOrder = async (currentUser: any, payload: any) => {
    if (payload.price < 0) {
      throw new apiError(400, "Price must be greater than or equal to 0");
    }

    const ownerUserId = payload.user || currentUser.userId;

    if (currentUser.role === "User" && ownerUserId !== currentUser.userId) {
      throw new apiError(Errors.Forbidden.code, "Users can only create their own ride orders");
    }

    const user = await this.userRepo.findUserById(ownerUserId);
    if (!user) {
      throw new apiError(Errors.NotFound.code, "User not found for this order");
    }

    if (payload.rider) {
      const rider = await this.userRepo.findUserById(payload.rider);
      if (!rider || rider.role !== "Rider") {
        throw new apiError(400, "Assigned rider must be a valid Rider user");
      }
    }

    const existingOrderCount = await this.orderRepo.countOrdersByUser(ownerUserId);
    const eligibleForReferralDiscount =
      existingOrderCount === 0 &&
      !!user.referredByReferralCode &&
      !user.referralDiscountUsed;

    const discountAmount = eligibleForReferralDiscount
      ? Math.min(REFERRAL_FIRST_ORDER_DISCOUNT, payload.price)
      : 0;

    const stoppages = (payload.stoppages || []).map((stoppage: any, index: number) => ({
      ...stoppage,
      sequence: index + 1,
    }));

    const initialStatus = payload.rider ? "Accepted" : "Pending";
    const now = new Date();

    const order = await this.orderRepo.createOrder({
      ...payload,
      stoppages,
      originalPrice: payload.price,
      price: payload.price - discountAmount,
      discountAmount,
      discountType: discountAmount > 0 ? "ReferralFirstOrder" : undefined,
      user: ownerUserId,
      status: initialStatus,
      acceptedAt: payload.rider ? now : null,
      statusHistory: [
        this.buildStatusHistoryEntry(currentUser, initialStatus, "Order created"),
      ],
    });

    if (discountAmount > 0) {
      await this.userRepo.updateUser(ownerUserId, { referralDiscountUsed: true });
    }

    return this.orderRepo.getOrderById(String(order._id));
  };

  estimatePrice = async (payload: {
    distanceKm: number;
    durationMin: number;
    vehicleType: "Bike" | "Car" | "Truck";
  }) => {
    const common = await this.commonRepo.getContent();
    const deliverySettings = (common?.deliverySettings || {}) as {
      baseDeliveryCharge?: number;
      chargePerMile?: number;
      minimumDistanceMiles?: number;
    };
    const distanceMiles = payload.distanceKm * KM_TO_MILES;
    const billableDistanceMiles = Math.max(
      distanceMiles,
      deliverySettings.minimumDistanceMiles || 0
    );
    const price =
      (deliverySettings.baseDeliveryCharge || 0) +
      billableDistanceMiles * (deliverySettings.chargePerMile || 0);

    return {
      distanceKm: payload.distanceKm,
      durationMin: payload.durationMin,
      vehicleType: payload.vehicleType,
      price: Number(price.toFixed(2)),
      currency: ORDER_PRICE_CURRENCY,
    };
  };

  getAllOrders = async (currentUser: any, query: any) => {
    const scopedQuery = { ...query };

    if (currentUser.role === "User") {
      scopedQuery.userId = currentUser.userId;
    }

    if (currentUser.role === "Rider") {
      if (query.scope === "available") {
        scopedQuery.unassigned = true;
        scopedQuery.status = "Pending";
        scopedQuery.availableForRider = true;
        delete scopedQuery.riderId;
      } else {
        scopedQuery.riderId = currentUser.userId;
      }
    }

    return this.orderRepo.getAllOrders(scopedQuery);
  };

  getOrderSummary = async (currentUser: any) => {
    return this.orderRepo.getOrderSummary(currentUser);
  };

  getOrderById = async (currentUser: any, id: string) => {
    const order = await this.orderRepo.getOrderById(id);

    if (!order) {
      throw new apiError(Errors.NotFound.code, "Order not found");
    }

    if (
      currentUser.role !== "Admin" &&
      String(order.user?._id || order.user) !== currentUser.userId &&
      String(order.rider?._id || order.rider) !== currentUser.userId &&
      !(
        currentUser.role === "Rider" &&
        order.status === "Pending" &&
        !order.rider
      )
    ) {
      throw new apiError(Errors.Forbidden.code, "You do not have access to this order");
    }

    return order;
  };

  assignRider = async (currentUser: any, orderId: string, riderId: string) => {
    const order = await this.orderRepo.getOrderById(orderId);

    if (!order) {
      throw new apiError(Errors.NotFound.code, "Order not found");
    }

    if (currentUser.role === "Rider") {
      if (order.status !== "Pending") {
        throw new apiError(400, "Only pending orders can be accepted");
      }

      if ((order as any).paymentMethod === "Card" && order.paymentStatus !== "Paid") {
        throw new apiError(400, "Card orders must be paid before accepting");
      }

      if (currentUser.userId !== riderId) {
        throw new apiError(Errors.Forbidden.code, "Rider can only assign themselves");
      }
      if (this.getActorId(order.rider) !== null && this.getActorId(order.rider) !== currentUser.userId) {
        throw new apiError(Errors.Forbidden.code, "Order already assigned to another rider");
      }
    }

    if (order.status === "Completed" || order.status === "Cancelled") {
      throw new apiError(400, "Cannot assign rider to a completed or cancelled order");
    }

    const rider = await this.userRepo.findUserById(riderId);
    if (!rider || rider.role !== "Rider") {
      throw new apiError(400, "Invalid rider");
    }

    const updatePayload: Record<string, any> = {
      rider: riderId,
      status: order.status === "Pending" ? "Accepted" : order.status,
      acceptedAt: order.status === "Pending" ? new Date() : order.acceptedAt,
    };

    if (order.status === "Pending") {
      updatePayload.$push = {
        statusHistory: this.buildStatusHistoryEntry(
          currentUser,
          "Accepted",
          "Rider assigned"
        ),
      };
    }

    if (currentUser.role === "Rider") {
      const acceptedOrder = await this.orderRepo.acceptPendingOrder(
        orderId,
        updatePayload
      );

      if (!acceptedOrder) {
        throw new apiError(400, "Order is no longer available");
      }

      return acceptedOrder;
    }

    return this.orderRepo.updateOrder(orderId, updatePayload);
  };

  updateOrderStatus = async (
    currentUser: any,
    orderId: string,
    status: string
  ) => {
    const order = await this.orderRepo.getOrderById(orderId);

    if (!order) {
      throw new apiError(Errors.NotFound.code, "Order not found");
    }

    const assignedRiderId = this.getActorId(order.rider);

    if (currentUser.role === "Rider" && assignedRiderId !== currentUser.userId) {
      throw new apiError(Errors.Forbidden.code, "Only assigned rider can update order status");
    }

    if (currentUser.role === "User") {
      throw new apiError(Errors.Forbidden.code, "User cannot update order status directly");
    }

    const allowed = VALID_TRANSITIONS[order.status] || [];
    if (!allowed.includes(status)) {
      throw new apiError(
        400,
        `Invalid status transition from ${order.status} to ${status}`
      );
    }

    const updatePayload: Record<string, any> = {
      status,
      $push: {
        statusHistory: this.buildStatusHistoryEntry(currentUser, status),
      },
    };

    if (status === "Accepted") {
      updatePayload.acceptedAt = new Date();
    }
    if (status === "ArrivedPickup") {
      updatePayload.pickupReachedAt = new Date();
    }
    if (status === "InProgress") {
      updatePayload.tripStartedAt = new Date();
    }
    if (status === "Completed") {
      updatePayload.completedAt = new Date();
      updatePayload.dropoffReachedAt = new Date();
    }
    if (status === "Cancelled") {
      updatePayload.cancelledAt = new Date();
    }

    return this.orderRepo.updateOrder(orderId, updatePayload);
  };

  updateOrderPrice = async (
    currentUser: any,
    orderId: string,
    price: number
  ) => {
    if (currentUser.role !== "Admin") {
      throw new apiError(Errors.Forbidden.code, "Only admin can update ride price");
    }

    if (price < 0) {
      throw new apiError(400, "Price must be greater than or equal to 0");
    }

    const order = await this.orderRepo.getOrderById(orderId);
    if (!order) {
      throw new apiError(Errors.NotFound.code, "Order not found");
    }

    return this.orderRepo.updateOrder(orderId, { price });
  };

  cancelOrder = async (currentUser: any, orderId: string) => {
    const order = await this.orderRepo.getOrderById(orderId);

    if (!order) {
      throw new apiError(Errors.NotFound.code, "Order not found");
    }

    const isOwner = String(order.user?._id || order.user) === currentUser.userId;
    const isAssignedRider = String(order.rider?._id || order.rider) === currentUser.userId;
    const isAdmin = currentUser.role === "Admin";

    if (!isOwner && !isAssignedRider && !isAdmin) {
      throw new apiError(Errors.Forbidden.code, "You cannot cancel this order");
    }

    if (order.status === "Completed" || order.status === "Cancelled") {
      throw new apiError(400, `Order already ${order.status}`);
    }

    return this.orderRepo.updateOrder(orderId, {
      status: "Cancelled",
      cancelledAt: new Date(),
      $push: {
        statusHistory: this.buildStatusHistoryEntry(currentUser, "Cancelled"),
      },
    });
  };

  addReview = async (
    currentUser: any,
    orderId: string,
    payload: { rating: number; comment?: string }
  ) => {
    const order = await this.orderRepo.getOrderById(orderId);

    if (!order) {
      throw new apiError(Errors.NotFound.code, "Order not found");
    }

    if (String(order.user?._id || order.user) !== currentUser.userId) {
      throw new apiError(
        Errors.Forbidden.code,
        "Only the customer can review this order"
      );
    }

    if (order.status !== "Completed") {
      throw new apiError(400, "Review can only be added after order completion");
    }

    if (order.review) {
      throw new apiError(400, "Review already submitted for this order");
    }

    return this.orderRepo.updateOrder(orderId, {
      review: {
        rating: payload.rating,
        comment: payload.comment,
        reviewedAt: new Date(),
      },
    });
  };

  submitCompletionProof = async (
    currentUser: any,
    orderId: string,
    payload: { images: string[]; note?: string }
  ) => {
    const order = await this.orderRepo.getOrderById(orderId);

    if (!order) {
      throw new apiError(Errors.NotFound.code, "Order not found");
    }

    if (currentUser.role !== "Rider") {
      throw new apiError(
        Errors.Forbidden.code,
        "Only the assigned rider can submit completion proof"
      );
    }

    if (this.getActorId(order.rider) !== currentUser.userId) {
      throw new apiError(
        Errors.Forbidden.code,
        "Only the assigned rider can submit completion proof"
      );
    }

    if (order.status !== "Completed") {
      throw new apiError(
        400,
        "Completion proof can only be submitted after order completion"
      );
    }

    if ((order as any).completionProof) {
      throw new apiError(400, "Completion proof already submitted for this order");
    }

    if (!payload.images.length) {
      throw new apiError(400, "At least one completion proof image is required");
    }

    return this.orderRepo.updateOrder(orderId, {
      completionProof: {
        images: payload.images,
        note: payload.note,
        submittedAt: new Date(),
        submittedBy: currentUser.userId,
      },
    });
  };

  deleteOrder = async (currentUser: any, id: string) => {
    if (currentUser.role !== "Admin") {
      throw new apiError(Errors.Forbidden.code, "Only admin can delete order");
    }

    const order = await this.orderRepo.getOrderById(id);
    if (!order) {
      throw new apiError(Errors.NotFound.code, "Order not found");
    }

    return this.orderRepo.deleteOrder(id);
  };

  markCheckpointReached = async (
    currentUser: any,
    orderId: string,
    payload: { pointType: "pickup" | "stoppage" | "dropoff"; stoppageId?: string; note?: string }
  ) => {
    const order = await this.orderRepo.getOrderById(orderId);

    if (!order) {
      throw new apiError(Errors.NotFound.code, "Order not found");
    }

    const assignedRiderId = this.getActorId(order.rider);

    if (currentUser.role === "Rider" && assignedRiderId !== currentUser.userId) {
      throw new apiError(Errors.Forbidden.code, "Only assigned rider can update checkpoints");
    }

    if (currentUser.role === "User") {
      throw new apiError(Errors.Forbidden.code, "User cannot update trip checkpoints");
    }

    if (!assignedRiderId) {
      throw new apiError(400, "A rider must be assigned before tracking trip progress");
    }

    const now = new Date();

    if (payload.pointType === "pickup") {
      if (order.status !== "Accepted") {
        throw new apiError(400, "Pickup can only be marked after the order is accepted");
      }

      if (order.pickupReachedAt) {
        throw new apiError(400, "Pickup is already marked as reached");
      }

      return this.orderRepo.updateOrder(orderId, {
        status: "ArrivedPickup",
        pickupReachedAt: now,
        $push: {
          statusHistory: this.buildStatusHistoryEntry(
            currentUser,
            "ArrivedPickup",
            payload.note || "Rider reached pickup point"
          ),
        },
      });
    }

    if (payload.pointType === "stoppage") {
      if (!["ArrivedPickup", "InProgress"].includes(order.status)) {
        throw new apiError(
          400,
          "Stoppages can only be marked after reaching the pickup point"
        );
      }

      const stoppages = ((order as any).stoppages || []).map((stoppage: any) => ({
        ...(typeof stoppage.toObject === "function" ? stoppage.toObject() : stoppage),
      }));
      const stoppage = stoppages.find(
        (item: any) => String(item._id) === String(payload.stoppageId)
      );

      if (!stoppage) {
        throw new apiError(404, "Stoppage not found");
      }

      if (stoppage.reachedAt) {
        throw new apiError(400, "Stoppage already marked as reached");
      }

      stoppage.reachedAt = now;

      return this.orderRepo.updateOrder(orderId, {
        stoppages,
        status: order.status === "ArrivedPickup" ? "InProgress" : order.status,
        tripStartedAt: order.tripStartedAt || now,
        $push: {
          statusHistory: this.buildStatusHistoryEntry(
            currentUser,
            order.status === "ArrivedPickup" ? "InProgress" : order.status,
            payload.note || `Reached stoppage ${stoppage.label || stoppage.sequence}`
          ),
        },
      });
    }

    if (!["ArrivedPickup", "InProgress"].includes(order.status)) {
      throw new apiError(
        400,
        "Drop-off can only be marked after reaching the pickup point"
      );
    }

    const hasPendingStoppages = ((order as any).stoppages || []).some(
      (stoppage: any) => !stoppage.reachedAt
    );

    if (hasPendingStoppages) {
      throw new apiError(400, "All stoppages must be completed before drop-off");
    }

    if (order.dropoffReachedAt) {
      throw new apiError(400, "Drop-off is already marked as reached");
    }

    return this.orderRepo.updateOrder(orderId, {
      status: "Completed",
      tripStartedAt: order.tripStartedAt || now,
      dropoffReachedAt: now,
      completedAt: now,
      $push: {
        statusHistory: this.buildStatusHistoryEntry(
          currentUser,
          "Completed",
          payload.note || "Reached final drop-off point"
        ),
      },
    });
  };
}
