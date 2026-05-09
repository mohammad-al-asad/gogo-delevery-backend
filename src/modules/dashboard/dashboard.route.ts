import { Router } from "express";
import { authMiddleware, dashboardController } from "../../container";

const dashboardRoute = Router();

dashboardRoute.use(authMiddleware.authenticate);

dashboardRoute.get(
  "/rider/earnings",
  authMiddleware.authorize(["Rider"]),
  dashboardController.getRiderEarnings
);

dashboardRoute.use(authMiddleware.authorize(["Admin"]));

dashboardRoute.get("/", dashboardController.getAdminDashboard);
dashboardRoute.get("/overview", dashboardController.getOverview);
dashboardRoute.get("/revenue-trend", dashboardController.getRevenueTrend);
dashboardRoute.get("/user-growth", dashboardController.getUserGrowth);
dashboardRoute.get("/rider-growth", dashboardController.getRiderGrowth);
dashboardRoute.get("/income-growth", dashboardController.getIncomeGrowth);
dashboardRoute.get("/recent-orders", dashboardController.getRecentOrders);
dashboardRoute.get("/earnings", dashboardController.getEarnings);
dashboardRoute.get("/hot-areas", dashboardController.getHotAreas);
dashboardRoute.get(
  "/payment-status-breakdown",
  dashboardController.getPaymentStatusBreakdown
);

export default dashboardRoute;
