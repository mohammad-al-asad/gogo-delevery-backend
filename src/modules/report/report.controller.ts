import { NextFunction, Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { HttpCodes } from "../../constants/status-codes";
import { ReportService } from "./report.service";
import { GetReportsQuerySchema } from "./report.schema";

export class ReportController {
  constructor(private reportService: ReportService) {}

  createReport = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const report = await this.reportService.createReport(req.user, req.body);

      res.status(HttpCodes.Created).json({
        success: true,
        message: "Report submitted successfully",
        data: report,
      });
    }
  );

  getReports = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const queryResult = GetReportsQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        throw queryResult.error;
      }

      const reports = await this.reportService.getReports(req.user, queryResult.data);

      res.status(HttpCodes.Ok).json({
        success: true,
        message: "Reports fetched successfully",
        data: reports.data,
        total: reports.total,
        page: reports.page,
        limit: reports.limit,
      });
    }
  );

  getReportById = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const report = await this.reportService.getReportById(req.user, req.params.id as string);

      res.status(HttpCodes.Ok).json({
        success: true,
        message: "Report fetched successfully",
        data: report,
      });
    }
  );

  resolveReport = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const report = await this.reportService.resolveReport(
        req.user,
        req.params.id as string,
        req.body
      );

      res.status(HttpCodes.Ok).json({
        success: true,
        message: "Report resolved successfully",
        data: report,
      });
    }
  );
}
