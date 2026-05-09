import Order from "../order/order.model";
import Payment from "../payment/payment.model";
import User from "../user/user.model";
import { Types } from "mongoose";

type DashboardFilters = {
  dateFrom: Date;
  dateTo: Date;
  year?: number;
  status?: string;
  area?: string;
  search?: string;
  recentLimit: number;
  hotAreaLimit: number;
  groupBy: "daily" | "weekly" | "monthly" | "yearly";
};

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export class DashboardRepository {
  private getRiderEarningsDateRanges() {
    const now = new Date();

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const monthStart = new Date(now);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    return { now, todayStart, weekStart, monthStart };
  }

  private buildOrderAttributeMatch(filters: DashboardFilters) {
    const match: Record<string, any> = {};

    if (filters.status) {
      match.status = filters.status;
    }

    if (filters.area) {
      match.$or = [
        { "pickup.label": filters.area },
        { "pickup.addressLine": filters.area },
        { "dropoff.label": filters.area },
        { "dropoff.addressLine": filters.area },
      ];
    }

    if (filters.search) {
      const regex = new RegExp(filters.search, "i");
      const searchConditions = [
        { "pickup.label": regex },
        { "pickup.addressLine": regex },
        { "dropoff.label": regex },
        { "dropoff.addressLine": regex },
      ];

      if (match.$or) {
        match.$and = [{ $or: match.$or }, { $or: searchConditions }];
        delete match.$or;
      } else {
        match.$or = searchConditions;
      }
    }

    return match;
  }

  private buildOrderMatch(filters: DashboardFilters) {
    const match: Record<string, any> = {
      ...this.buildOrderAttributeMatch(filters),
      createdAt: {
        $gte: filters.dateFrom,
        $lte: filters.dateTo,
      },
    };

    return match;
  }

  private buildPeriodExpression(groupBy: DashboardFilters["groupBy"]) {
    if (groupBy === "yearly") {
      return {
        $dateToString: {
          format: "%Y",
          date: "$createdAt",
        },
      };
    }

    if (groupBy === "weekly") {
      return {
        $dateToString: {
          format: "%G-W%V",
          date: "$createdAt",
        },
      };
    }

    if (groupBy === "monthly") {
      return {
        $dateToString: {
          format: "%Y-%m",
          date: "$createdAt",
        },
      };
    }

    return {
      $dateToString: {
        format: "%Y-%m-%d",
        date: "$createdAt",
      },
    };
  }

  private buildCreatedAtMatch(filters: DashboardFilters) {
    return {
      createdAt: {
        $gte: filters.dateFrom,
        $lte: filters.dateTo,
      },
    };
  }

  private buildMonthlySeries = (
    results: Array<{ month: number; value: number }>,
    valueKey: string
  ) => {
    const valuesByMonth = new Map(
      results.map((item) => [item.month, Number(item.value || 0)])
    );

    return MONTH_LABELS.map((month, index) => ({
      month,
      [valueKey]: valuesByMonth.get(index + 1) || 0,
    }));
  };

  private getCurrentRevenueRanges() {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const monthStart = new Date(now);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    return { now, todayStart, monthStart };
  }

  private getRevenueSummary = async (filters: DashboardFilters) => {
    const { now, todayStart, monthStart } = this.getCurrentRevenueRanges();
    const baseMatch = this.buildOrderAttributeMatch(filters);

    const revenueStats = await Order.aggregate([
      {
        $match: {
          ...baseMatch,
          paymentStatus: "Paid",
          createdAt: { $lte: now },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$price" },
          thisMonthRevenue: {
            $sum: {
              $cond: [{ $gte: ["$createdAt", monthStart] }, "$price", 0],
            },
          },
          todayRevenue: {
            $sum: {
              $cond: [{ $gte: ["$createdAt", todayStart] }, "$price", 0],
            },
          },
        },
      },
    ]);

    return (
      revenueStats[0] || {
        totalRevenue: 0,
        thisMonthRevenue: 0,
        todayRevenue: 0,
      }
    );
  };

  getOverview = async (filters: DashboardFilters) => {
    const orderMatch = this.buildOrderMatch(filters);
    const activeStatuses = ["Pending", "Accepted", "ArrivedPickup", "InProgress"];

    const [orderStats, userStats, revenueSummary] = await Promise.all([
      Order.aggregate([
        { $match: orderMatch },
        {
          $addFields: {
            areaName: {
              $ifNull: [
                "$pickup.label",
                {
                  $ifNull: ["$pickup.addressLine", "Unknown Area"],
                },
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            activeRiders: {
              $addToSet: {
                $cond: [
                  {
                    $and: [
                      { $ne: ["$rider", null] },
                      { $ne: [{ $type: "$rider" }, "missing"] },
                    ],
                  },
                  "$rider",
                  "$$REMOVE",
                ],
              },
            },
            areas: { $addToSet: "$areaName" },
            totalRevenue: {
              $sum: {
                $cond: [{ $eq: ["$paymentStatus", "Paid"] }, "$price", 0],
              },
            },
            activeOrdersCurrentPeriod: {
              $sum: {
                $cond: [{ $in: ["$status", activeStatuses] }, 1, 0],
              },
            },
            completedOrdersCurrentPeriod: {
              $sum: {
                $cond: [{ $eq: ["$status", "Completed"] }, 1, 0],
              },
            },
            cancelledOrdersCurrentPeriod: {
              $sum: {
                $cond: [{ $eq: ["$status", "Cancelled"] }, 1, 0],
              },
            },
            paidOrdersCurrentPeriod: {
              $sum: {
                $cond: [{ $eq: ["$paymentStatus", "Paid"] }, 1, 0],
              },
            },
            totalOrderValue: { $sum: "$price" },
          },
        },
      ]),
      Promise.all([
        User.countDocuments({ role: "User" }),
        User.countDocuments({ role: "Rider" }),
        Order.distinct("user", orderMatch),
      ]),
      this.getRevenueSummary(filters),
    ]);

    const orderMetrics = orderStats[0] || {
      totalOrders: 0,
      activeRiders: [],
      areas: [],
      totalRevenue: 0,
      activeOrdersCurrentPeriod: 0,
      completedOrdersCurrentPeriod: 0,
      cancelledOrdersCurrentPeriod: 0,
      paidOrdersCurrentPeriod: 0,
      totalOrderValue: 0,
    };

    return {
      totalUsers: userStats[0],
      totalRiders: userStats[1],
      totalOrders: orderMetrics.totalOrders,
      totalEarning: revenueSummary.totalRevenue,
      totalRevenue: revenueSummary.totalRevenue,
      thisMonthRevenue: revenueSummary.thisMonthRevenue,
      todayRevenue: revenueSummary.todayRevenue,
      currentPeriodRevenue: orderMetrics.totalRevenue,
      activeDrivers: orderMetrics.activeRiders.length,
      avgOrdersPerArea:
        orderMetrics.areas.length > 0
          ? Number((orderMetrics.totalOrders / orderMetrics.areas.length).toFixed(2))
          : 0,
      activeUsersCurrentPeriod: userStats[2].length,
      activeOrdersCurrentPeriod: orderMetrics.activeOrdersCurrentPeriod,
      completedOrdersCurrentPeriod: orderMetrics.completedOrdersCurrentPeriod,
      cancelledOrdersCurrentPeriod: orderMetrics.cancelledOrdersCurrentPeriod,
      paidOrdersCurrentPeriod: orderMetrics.paidOrdersCurrentPeriod,
      averageOrderValue:
        orderMetrics.totalOrders > 0
          ? Number((orderMetrics.totalOrderValue / orderMetrics.totalOrders).toFixed(2))
          : 0,
    };
  };

  getRevenueTrend = async (filters: DashboardFilters) => {
    const orderMatch = this.buildOrderMatch(filters);

    const results = await Order.aggregate([
      {
        $match: {
          ...orderMatch,
          paymentStatus: "Paid",
        },
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          revenue: { $sum: "$price" },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          month: "$_id",
          value: "$revenue",
        },
      },
    ]);

    return this.buildMonthlySeries(results, "revenue");
  };

  getUserGrowth = async (filters: DashboardFilters) => {
    const results = await User.aggregate([
      {
        $match: {
          ...this.buildCreatedAtMatch(filters),
          role: "User",
        },
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          users: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          month: "$_id",
          value: "$users",
        },
      },
    ]);

    return this.buildMonthlySeries(results, "users");
  };

  getRiderGrowth = async (filters: DashboardFilters) => {
    const results = await User.aggregate([
      {
        $match: {
          ...this.buildCreatedAtMatch(filters),
          role: "Rider",
        },
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          riders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          month: "$_id",
          value: "$riders",
        },
      },
    ]);

    return this.buildMonthlySeries(results, "riders");
  };

  getIncomeGrowth = async (filters: DashboardFilters) => {
    const results = await Payment.aggregate([
      {
        $match: {
          ...this.buildCreatedAtMatch(filters),
          status: "Captured",
        },
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          earnings: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          month: "$_id",
          value: "$earnings",
        },
      },
    ]);

    return this.buildMonthlySeries(results, "earnings");
  };

  getRecentOrders = async (filters: DashboardFilters) => {
    const orderMatch = this.buildOrderMatch(filters);

    return Order.find(orderMatch)
      .populate("user", "firstName lastName phoneNumber")
      .populate("rider", "firstName lastName phoneNumber")
      .populate("completionProof.submittedBy", "firstName lastName phoneNumber role")
      .sort({ createdAt: -1 })
      .limit(filters.recentLimit)
      .lean();
  };

  getEarnings = async (filters: DashboardFilters) => {
    const orderMatch = this.buildOrderMatch(filters);

    return Order.find({
      ...orderMatch,
      paymentStatus: "Paid",
    })
      .populate("user", "firstName lastName")
      .sort({ createdAt: -1 })
      .limit(filters.recentLimit)
      .lean();
  };

  getRiderEarnings = async (riderId: string, recentLimit: number) => {
    const riderObjectId = new Types.ObjectId(riderId);
    const { now, todayStart, weekStart, monthStart } = this.getRiderEarningsDateRanges();
    const baseMatch = {
      rider: riderObjectId,
      status: "Completed" as const,
    };
    const paidMatch = {
      ...baseMatch,
      paymentStatus: "Paid",
    };

    const [summary, pendingSummary, dailyTrend, transactions] = await Promise.all([
      Order.aggregate([
        { $match: paidMatch },
        {
          $addFields: {
            earningDate: { $ifNull: ["$completedAt", "$updatedAt"] },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$price" },
            today: {
              $sum: {
                $cond: [{ $gte: ["$earningDate", todayStart] }, "$price", 0],
              },
            },
            week: {
              $sum: {
                $cond: [{ $gte: ["$earningDate", weekStart] }, "$price", 0],
              },
            },
            month: {
              $sum: {
                $cond: [{ $gte: ["$earningDate", monthStart] }, "$price", 0],
              },
            },
          },
        },
      ]),
      Order.aggregate([
        {
          $match: {
            ...baseMatch,
            paymentStatus: { $ne: "Paid" },
          },
        },
        {
          $group: {
            _id: null,
            pending: { $sum: "$price" },
          },
        },
      ]),
      Order.aggregate([
        { $match: paidMatch },
        {
          $addFields: {
            earningDate: { $ifNull: ["$completedAt", "$updatedAt"] },
          },
        },
        {
          $match: {
            earningDate: {
              $gte: weekStart,
              $lte: now,
            },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$earningDate",
              },
            },
            amount: { $sum: "$price" },
            rides: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            date: "$_id",
            amount: 1,
            rides: 1,
          },
        },
      ]),
      Order.find(baseMatch)
        .sort({ completedAt: -1, updatedAt: -1 })
        .limit(recentLimit)
        .lean(),
    ]);

    const totals = summary[0] || {
      total: 0,
      today: 0,
      week: 0,
      month: 0,
    };

    return {
      total: Number((totals.total || 0).toFixed(2)),
      today: Number((totals.today || 0).toFixed(2)),
      week: Number((totals.week || 0).toFixed(2)),
      month: Number((totals.month || 0).toFixed(2)),
      pending: Number(((pendingSummary[0]?.pending || 0)).toFixed(2)),
      dailyTrend: dailyTrend.map((item) => ({
        date: item.date,
        amount: Number((item.amount || 0).toFixed(2)),
        rides: item.rides || 0,
      })),
      transactions: transactions.map((order: any) => {
        const destination =
          order.dropoff?.label ||
          order.dropoff?.addressLine ||
          "destination";

        return {
          id: String(order._id),
          type: "ride",
          amount: Number((order.price || 0).toFixed(2)),
          status: order.paymentStatus === "Paid" ? "completed" : "pending",
          date: order.completedAt || order.updatedAt || order.createdAt,
          description: `Ride to ${destination}`,
          rideId: String(order._id),
        };
      }),
    };
  };

  getHotAreas = async (filters: DashboardFilters) => {
    const orderMatch = this.buildOrderMatch(filters);

    return Order.aggregate([
      { $match: orderMatch },
      {
        $addFields: {
          areaName: {
            $ifNull: [
              "$pickup.label",
              {
                $ifNull: ["$pickup.addressLine", "Unknown Area"],
              },
            ],
          },
        },
      },
      {
        $group: {
          _id: "$areaName",
          totalOrders: { $sum: 1 },
          riders: {
            $addToSet: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$rider", null] },
                    { $ne: [{ $type: "$rider" }, "missing"] },
                  ],
                },
                "$rider",
                "$$REMOVE",
              ],
            },
          },
          totalRevenue: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "Paid"] }, "$price", 0],
            },
          },
          averageLatitude: { $avg: "$pickup.latitude" },
          averageLongitude: { $avg: "$pickup.longitude" },
        },
      },
      { $sort: { totalOrders: -1, totalRevenue: -1, _id: 1 } },
      { $limit: filters.hotAreaLimit },
      {
        $project: {
          _id: 0,
          area: "$_id",
          totalOrders: 1,
          totalRiders: { $size: "$riders" },
          totalRevenue: 1,
          center: {
            latitude: "$averageLatitude",
            longitude: "$averageLongitude",
          },
        },
      },
    ]);
  };

  getPaymentStatusBreakdown = async (filters: DashboardFilters) => {
    return Payment.aggregate([
      {
        $match: {
          createdAt: {
            $gte: filters.dateFrom,
            $lte: filters.dateTo,
          },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          amount: { $sum: "$amount" },
        },
      },
      { $sort: { count: -1, _id: 1 } },
      {
        $project: {
          _id: 0,
          status: "$_id",
          count: 1,
          amount: 1,
        },
      },
    ]);
  };
}
