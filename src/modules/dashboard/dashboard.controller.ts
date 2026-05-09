import { NextFunction, Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { HttpCodes } from "../../constants/status-codes";
import { apiError } from "../../errors/api-error";
import { Errors } from "../../constants/error-codes";
import { DashboardService } from "./dashboard.service";
import { dashboardQuerySchema } from "./dashboard.schema";

export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  private parseQuery(req: Request) {
    if (!req.user) {
      throw new apiError(Errors.Unauthorized.code, Errors.Unauthorized.message);
    }

    const queryResult = dashboardQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      throw queryResult.error;
    }

    return queryResult.data;
  }

  getAdminDashboard = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const dashboard = await this.dashboardService.getAdminDashboard(
        req.user,
        this.parseQuery(req),
      );

      res.status(HttpCodes.Ok).json({
        success: true,
        message: "Admin dashboard fetched successfully",
        data: dashboard,
      });
    },
  );

  getOverview = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.dashboardService.getOverview(
      req.user,
      this.parseQuery(req),
    );
    res
      .status(HttpCodes.Ok)
      .json({
        success: true,
        message: "Dashboard overview fetched successfully",
        data,
      });
  });

  getRevenueTrend = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.dashboardService.getRevenueTrend(
      req.user,
      this.parseQuery(req),
    );
    res
      .status(HttpCodes.Ok)
      .json({
        success: true,
        message: "Revenue trend fetched successfully",
        data,
      });
  });

  getUserGrowth = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.dashboardService.getUserGrowth(
      req.user,
      this.parseQuery(req),
    );
    res
      .status(HttpCodes.Ok)
      .json({
        success: true,
        message: "User growth fetched successfully",
        data,
      });
  });

  getRiderGrowth = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.dashboardService.getRiderGrowth(
      req.user,
      this.parseQuery(req),
    );
    res
      .status(HttpCodes.Ok)
      .json({
        success: true,
        message: "Rider growth fetched successfully",
        data,
      });
  });

  getIncomeGrowth = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.dashboardService.getIncomeGrowth(
      req.user,
      this.parseQuery(req),
    );
    res
      .status(HttpCodes.Ok)
      .json({
        success: true,
        message: "Income growth fetched successfully",
        data,
      });
  });

  getRecentOrders = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.dashboardService.getRecentOrders(
      req.user,
      this.parseQuery(req),
    );
    res
      .status(HttpCodes.Ok)
      .json({
        success: true,
        message: "Recent orders fetched successfully",
        data,
      });
  });

  getEarnings = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.dashboardService.getEarnings(
      req.user,
      this.parseQuery(req),
    );
    res
      .status(HttpCodes.Ok)
      .json({ success: true, message: "Earnings fetched successfully", data });
  });

  getRiderEarnings = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.dashboardService.getRiderEarnings(
      req.user,
      this.parseQuery(req),
    );

    res
      .status(HttpCodes.Ok)
      .json({ success: true, message: "Rider earnings fetched successfully", data });
  });

  getHotAreas = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.dashboardService.getHotAreas(
      req.user,
      this.parseQuery(req),
    );
    res
      .status(HttpCodes.Ok)
      .json({ success: true, message: "Hot areas fetched successfully", data });
  });

  getPaymentStatusBreakdown = asyncHandler(
    async (req: Request, res: Response) => {
      const data = await this.dashboardService.getPaymentStatusBreakdown(
        req.user,
        this.parseQuery(req),
      );
      res
        .status(HttpCodes.Ok)
        .json({
          success: true,
          message: "Payment status breakdown fetched successfully",
          data,
        });
    },
  );
}
