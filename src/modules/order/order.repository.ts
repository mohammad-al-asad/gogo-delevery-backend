import Order from "./order.model";
import { Types } from "mongoose";

export class OrderRepository {
  countOrdersByUser = async (userId: string) => {
    return Order.countDocuments({ user: userId });
  };

  createOrder = async (payload: any) => {
    const order = new Order(payload);
    await order.save();
    return order;
  };

  getAllOrders = async (query: any) => {
    const page = Number(query.page) > 0 ? Number(query.page) : 1;
    const limit = Number(query.limit) > 0 ? Number(query.limit) : 20;
    const skip = (page - 1) * limit;

    const filter: any = {};

    if (query.status) {
      filter.status = query.status;
    }

    if (query.userId) {
      filter.user = query.userId;
    }

    if (query.riderId) {
      filter.rider = query.riderId;
    }

    if (query.unassigned === "true" || query.unassigned === true) {
      filter.rider = null;
      if (!query.status) {
        filter.status = "Pending";
      }
    }

    if (query.availableForRider === "true" || query.availableForRider === true) {
      filter.$or = [
        { paymentMethod: "Cash" },
        { paymentMethod: { $exists: false } },
        { paymentStatus: "Paid" },
      ];
    }

    const [data, total] = await Promise.all([
      Order.find(filter)
        .populate("user", "firstName lastName phoneNumber role")
        .populate("rider", "firstName lastName phoneNumber role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  };

  getOrderById = async (id: string) => {
    return Order.findById(id)
      .populate("user", "firstName lastName phoneNumber role")
      .populate("rider", "firstName lastName phoneNumber role")
      .populate("completionProof.submittedBy", "firstName lastName phoneNumber role");
  };

  updateOrder = async (id: string, payload: any) => {
    return Order.findByIdAndUpdate(id, payload, { new: true })
      .populate("user", "firstName lastName phoneNumber role")
      .populate("rider", "firstName lastName phoneNumber role")
      .populate("completionProof.submittedBy", "firstName lastName phoneNumber role");
  };

  acceptPendingOrder = async (id: string, payload: any) => {
    return Order.findOneAndUpdate(
      {
        _id: id,
        status: "Pending",
        rider: null,
        $or: [
          { paymentMethod: "Cash" },
          { paymentMethod: { $exists: false } },
          { paymentStatus: "Paid" },
        ],
      },
      payload,
      { new: true }
    )
      .populate("user", "firstName lastName phoneNumber role")
      .populate("rider", "firstName lastName phoneNumber role")
      .populate("completionProof.submittedBy", "firstName lastName phoneNumber role");
  };

  getOrderSummary = async (currentUser: any) => {
    if (currentUser.role === "Rider") {
      const riderObjectId = new Types.ObjectId(currentUser.userId);
      const [assignedOrders, completedOrders, cancelledOrders, availableOrders, earnings] =
        await Promise.all([
          Order.countDocuments({ rider: riderObjectId }),
          Order.countDocuments({ rider: riderObjectId, status: "Completed" }),
          Order.countDocuments({ rider: riderObjectId, status: "Cancelled" }),
          Order.countDocuments({ rider: null, status: "Pending" }),
          Order.aggregate([
            {
              $match: {
                rider: riderObjectId,
                status: "Completed",
              },
            },
            {
              $group: {
                _id: null,
                total: { $sum: "$price" },
              },
            },
          ]),
        ]);

      return {
        role: "Rider",
        assignedOrders,
        completedOrders,
        cancelledOrders,
        availableOrders,
        totalEarnings: earnings[0]?.total || 0,
      };
    }

    if (currentUser.role === "User") {
      const userObjectId = new Types.ObjectId(currentUser.userId);
      const [totalOrders, activeOrders, completedOrders, cancelledOrders, paidOrders] =
        await Promise.all([
          Order.countDocuments({ user: userObjectId }),
          Order.countDocuments({
            user: userObjectId,
            status: { $in: ["Pending", "Accepted", "ArrivedPickup", "InProgress"] },
          }),
          Order.countDocuments({ user: userObjectId, status: "Completed" }),
          Order.countDocuments({ user: userObjectId, status: "Cancelled" }),
          Order.countDocuments({ user: userObjectId, paymentStatus: "Paid" }),
        ]);

      return {
        role: "User",
        totalOrders,
        activeOrders,
        completedOrders,
        cancelledOrders,
        paidOrders,
      };
    }

    const [totalOrders, pendingOrders, activeOrders, completedOrders] =
      await Promise.all([
        Order.countDocuments({}),
        Order.countDocuments({ status: "Pending" }),
        Order.countDocuments({ status: { $in: ["Accepted", "ArrivedPickup", "InProgress"] } }),
        Order.countDocuments({ status: "Completed" }),
      ]);

    return {
      role: "Admin",
      totalOrders,
      pendingOrders,
      activeOrders,
      completedOrders,
    };
  };

  deleteOrder = async (id: string) => {
    return Order.findByIdAndDelete(id);
  };
}
