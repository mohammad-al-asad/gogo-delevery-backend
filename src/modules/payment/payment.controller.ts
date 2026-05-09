import { NextFunction, Request, Response } from "express";
import { HttpCodes } from "../../constants/status-codes";
import { Errors } from "../../constants/error-codes";
import { apiError } from "../../errors/api-error";
import { asyncHandler } from "../../utils/async-handler";
import { PaymentService } from "./payment.service";

export class PaymentController {
  constructor(private paymentService: PaymentService) {}

  initiatePayment = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      if (!req.user) {
        throw new apiError(Errors.Unauthorized.code, Errors.Unauthorized.message);
      }

      const result = await this.paymentService.initiatePayment(req.user, req.body);

      res.status(HttpCodes.Created).json({
        success: true,
        message: "Payment initiated successfully",
        data: result,
      });
    }
  );

  verifyPayment = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      if (!req.user) {
        throw new apiError(Errors.Unauthorized.code, Errors.Unauthorized.message);
      }

      const result = await this.paymentService.verifyPaymentByChargeId(
        req.user,
        req.body.chargeId
      );

      res.status(HttpCodes.Ok).json({
        success: true,
        message: "Payment verified successfully",
        data: result,
      });
    }
  );

  handleTapWebhook = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const result = await this.paymentService.handleTapWebhook(
        req.body,
        req.headers as Record<string, any>
      );

      res.status(HttpCodes.Ok).json({
        success: true,
        message: "Webhook processed",
        data: result,
      });
    }
  );

  getPaymentById = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      if (!req.user) {
        throw new apiError(Errors.Unauthorized.code, Errors.Unauthorized.message);
      }

      const payment = await this.paymentService.getPaymentById(req.user, req.params.id as string);

      res.status(HttpCodes.Ok).json({
        success: true,
        message: "Payment fetched successfully",
        data: payment,
      });
    }
  );

  getPaymentsByOrderId = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      if (!req.user) {
        throw new apiError(Errors.Unauthorized.code, Errors.Unauthorized.message);
      }

      const payments = await this.paymentService.getPaymentsByOrderId(
        req.user,
        req.params.orderId as string
      );

      res.status(HttpCodes.Ok).json({
        success: true,
        message: "Order payments fetched successfully",
        data: payments,
      });
    }
  );

  getMyPaymentHistory = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      if (!req.user) {
        throw new apiError(Errors.Unauthorized.code, Errors.Unauthorized.message);
      }

      const payments = await this.paymentService.getMyPaymentHistory(
        req.user,
        req.query
      );

      res.status(HttpCodes.Ok).json({
        success: true,
        message: "Payment history fetched successfully",
        data: payments.data,
        total: payments.total,
        page: payments.page,
        limit: payments.limit,
      });
    }
  );
}
