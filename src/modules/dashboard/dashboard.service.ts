import { apiError } from "../../errors/api-error";
import { Errors } from "../../constants/error-codes";
import { DashboardRepository } from "./dashboard.repository";
import { DashboardQuery } from "./dashboard.schema";

export class DashboardService {
  constructor(private dashboardRepository: DashboardRepository) {}

  private getDateRange(query: DashboardQuery) {
    if (query.year) {
      return {
        dateFrom: new Date(query.year, 0, 1, 0, 0, 0, 0),
        dateTo: new Date(query.year, 11, 31, 23, 59, 59, 999),
      };
    }

    if (query.dateFrom || query.dateTo) {
      return {
        dateFrom: query.dateFrom ? new Date(query.dateFrom) : new Date(0),
        dateTo: query.dateTo ? new Date(query.dateTo) : new Date(),
      };
    }

    const now = new Date();
    const dateFrom = new Date(now);

    if (query.groupBy === "monthly") {
      dateFrom.setMonth(now.getMonth() - 11);
      dateFrom.setDate(1);
      dateFrom.setHours(0, 0, 0, 0);
    } else if (query.groupBy === "yearly") {
      dateFrom.setFullYear(now.getFullYear() - 4, 0, 1);
      dateFrom.setHours(0, 0, 0, 0);
    } else if (query.groupBy === "weekly") {
      dateFrom.setDate(now.getDate() - 83);
      dateFrom.setHours(0, 0, 0, 0);
    } else {
      dateFrom.setDate(now.getDate() - 29);
      dateFrom.setHours(0, 0, 0, 0);
    }

    return {
      dateFrom,
      dateTo: now,
    };
  }

  private ensureAdmin(currentUser: any) {
    if (currentUser.role !== "Admin") {
      throw new apiError(Errors.Forbidden.code, "Only admin can access dashboard data");
    }
  }

  private ensureRider(currentUser: any) {
    if (currentUser.role !== "Rider") {
      throw new apiError(Errors.Forbidden.code, "Only riders can access rider earnings");
    }
  }

  private buildFilters(query: DashboardQuery) {
    const { dateFrom, dateTo } = this.getDateRange(query);

    return {
      ...query,
      dateFrom,
      dateTo,
      recentLimit: query.recentLimit ?? 10,
      hotAreaLimit: query.hotAreaLimit ?? 5,
      groupBy: query.groupBy ?? "daily",
    };
  }

  getAdminDashboard = async (currentUser: any, query: DashboardQuery) => {
    this.ensureAdmin(currentUser);

    const filters = this.buildFilters(query);

    const [
      overview,
      revenueTrend,
      userGrowth,
      riderGrowth,
      incomeGrowth,
      recentOrders,
      earnings,
      hotAreas,
      paymentStatusBreakdown,
    ] =
      await Promise.all([
        this.dashboardRepository.getOverview(filters),
        this.dashboardRepository.getRevenueTrend(filters),
        this.dashboardRepository.getUserGrowth(filters),
        this.dashboardRepository.getRiderGrowth(filters),
        this.dashboardRepository.getIncomeGrowth(filters),
        this.dashboardRepository.getRecentOrders(filters),
        this.dashboardRepository.getEarnings(filters),
        this.dashboardRepository.getHotAreas(filters),
        this.dashboardRepository.getPaymentStatusBreakdown(filters),
      ]);

    return {
      filters: {
        ...query,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      },
      overview,
      revenueTrend,
      userGrowth,
      riderGrowth,
      incomeGrowth,
      recentOrders: recentOrders.map((order: any) => ({
        orderId: String(order._id),
        customer: order.user
          ? {
              id: String(order.user._id),
              fullName: `${order.user.firstName || ""} ${order.user.lastName || ""}`.trim(),
              phoneNumber: order.user.phoneNumber,
            }
          : null,
        rider: order.rider
          ? {
              id: String(order.rider._id),
              fullName: `${order.rider.firstName || ""} ${order.rider.lastName || ""}`.trim(),
              phoneNumber: order.rider.phoneNumber,
            }
          : null,
        status: order.status,
        amount: order.price,
        paymentStatus: order.paymentStatus,
        review: order.review || null,
        completionProof: order.completionProof || null,
        area:
          order.pickup?.label ||
          order.pickup?.addressLine ||
          order.dropoff?.label ||
          order.dropoff?.addressLine ||
          "Unknown Area",
        createdAt: order.createdAt,
      })),
      earnings: earnings.map((order: any) => ({
        fullName: order.user
          ? `${order.user.firstName || ""} ${order.user.lastName || ""}`.trim()
          : "Unknown User",
        date: order.createdAt,
        commission: Number((order.price * 0.1).toFixed(2)),
        parcel: String(order._id),
      })),
      hotAreas: hotAreas.map((area: any) => ({
        areaName: area.area,
        numberOfRiders: area.totalRiders,
        numberOfOrders: area.totalOrders,
      })),
      paymentStatusBreakdown,
    };
  };

  getOverview = async (currentUser: any, query: DashboardQuery) => {
    this.ensureAdmin(currentUser);
    return this.dashboardRepository.getOverview(this.buildFilters(query));
  };

  getRevenueTrend = async (currentUser: any, query: DashboardQuery) => {
    this.ensureAdmin(currentUser);
    return this.dashboardRepository.getRevenueTrend(this.buildFilters(query));
  };

  getUserGrowth = async (currentUser: any, query: DashboardQuery) => {
    this.ensureAdmin(currentUser);
    return this.dashboardRepository.getUserGrowth(this.buildFilters(query));
  };

  getRiderGrowth = async (currentUser: any, query: DashboardQuery) => {
    this.ensureAdmin(currentUser);
    return this.dashboardRepository.getRiderGrowth(this.buildFilters(query));
  };

  getIncomeGrowth = async (currentUser: any, query: DashboardQuery) => {
    this.ensureAdmin(currentUser);
    return this.dashboardRepository.getIncomeGrowth(this.buildFilters(query));
  };

  getRecentOrders = async (currentUser: any, query: DashboardQuery) => {
    this.ensureAdmin(currentUser);

    const recentOrders = await this.dashboardRepository.getRecentOrders(
      this.buildFilters(query)
    );

    return recentOrders.map((order: any) => ({
      orderId: String(order._id),
      customer: order.user
        ? {
            id: String(order.user._id),
            fullName: `${order.user.firstName || ""} ${order.user.lastName || ""}`.trim(),
            phoneNumber: order.user.phoneNumber,
          }
        : null,
      rider: order.rider
        ? {
            id: String(order.rider._id),
            fullName: `${order.rider.firstName || ""} ${order.rider.lastName || ""}`.trim(),
            phoneNumber: order.rider.phoneNumber,
          }
        : null,
      status: order.status,
      amount: order.price,
      paymentStatus: order.paymentStatus,
      review: order.review || null,
      completionProof: order.completionProof || null,
      area:
        order.pickup?.label ||
        order.pickup?.addressLine ||
        order.dropoff?.label ||
        order.dropoff?.addressLine ||
        "Unknown Area",
      createdAt: order.createdAt,
    }));
  };

  getEarnings = async (currentUser: any, query: DashboardQuery) => {
    this.ensureAdmin(currentUser);

    const earnings = await this.dashboardRepository.getEarnings(this.buildFilters(query));

    return earnings.map((order: any) => ({
      fullName: order.user
        ? `${order.user.firstName || ""} ${order.user.lastName || ""}`.trim()
        : "Unknown User",
      date: order.createdAt,
      commission: Number((order.price * 0.1).toFixed(2)),
      parcel: String(order._id),
    }));
  };

  getRiderEarnings = async (currentUser: any, query: DashboardQuery) => {
    this.ensureRider(currentUser);

    return this.dashboardRepository.getRiderEarnings(
      currentUser.userId,
      query.recentLimit ?? 10,
    );
  };

  getHotAreas = async (currentUser: any, query: DashboardQuery) => {
    this.ensureAdmin(currentUser);

    const hotAreas = await this.dashboardRepository.getHotAreas(this.buildFilters(query));

    return hotAreas.map((area: any) => ({
      areaName: area.area,
      numberOfRiders: area.totalRiders,
      numberOfOrders: area.totalOrders,
    }));
  };

  getPaymentStatusBreakdown = async (currentUser: any, query: DashboardQuery) => {
    this.ensureAdmin(currentUser);
    return this.dashboardRepository.getPaymentStatusBreakdown(this.buildFilters(query));
  };
}
