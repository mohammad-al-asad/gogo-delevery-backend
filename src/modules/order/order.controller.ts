import { NextFunction, Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { HttpCodes } from "../../constants/status-codes";
import { apiError } from "../../errors/api-error";
import { Errors } from "../../constants/error-codes";
import { OrderService } from "./order.service";

export class OrderController {
  constructor(private orderService: OrderService) {}

  createOrder = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      if (!req.user) {
        throw new apiError(Errors.Unauthorized.code, Errors.Unauthorized.message);
      }

      const order = await this.orderService.createOrder(req.user, req.body);

      res.status(HttpCodes.Created).json({
        success: true,
        message: "Order created successfully",
        data: order,
      });
    }
  );

  estimatePrice = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const estimate = await this.orderService.estimatePrice(req.body);

      res.status(HttpCodes.Ok).json({
        success: true,
        message: "Order price estimated successfully",
        data: estimate,
      });
    }
  );

  getAllOrders = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      if (!req.user) {
        throw new apiError(Errors.Unauthorized.code, Errors.Unauthorized.message);
      }

      const orders = await this.orderService.getAllOrders(req.user, req.query);

      res.status(HttpCodes.Ok).json({
        success: true,
        message: "Orders fetched successfully",
        data: orders.data,
        total: orders.total,
        page: orders.page,
        limit: orders.limit,
      });
    }
  );

  getOrderSummary = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      if (!req.user) {
        throw new apiError(Errors.Unauthorized.code, Errors.Unauthorized.message);
      }

      const summary = await this.orderService.getOrderSummary(req.user);

      res.status(HttpCodes.Ok).json({
        success: true,
        message: "Order summary fetched successfully",
        data: summary,
      });
    }
  );

  getOrderById = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      if (!req.user) {
        throw new apiError(Errors.Unauthorized.code, Errors.Unauthorized.message);
      }

      const order = await this.orderService.getOrderById(req.user, req.params.id as string);

      res.status(HttpCodes.Ok).json({
        success: true,
        message: "Order fetched successfully",
        data: order,
      });
    }
  );

  assignRider = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      if (!req.user) {
        throw new apiError(Errors.Unauthorized.code, Errors.Unauthorized.message);
      }

      const riderId = req.user.role === "Rider" ? req.user.userId : req.body.riderId;
      if (!riderId) {
        throw new apiError(HttpCodes.BadRequest, "riderId is required");
      }

      const order = await this.orderService.assignRider(
        req.user,
        req.params.id as string,
        riderId
      );

      res.status(HttpCodes.Ok).json({
        success: true,
        message: "Rider assigned successfully",
        data: order,
      });
    }
  );

  updateOrderStatus = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      if (!req.user) {
        throw new apiError(Errors.Unauthorized.code, Errors.Unauthorized.message);
      }

      const status = req.body.status;
      if (!status) {
        throw new apiError(HttpCodes.BadRequest, "status is required");
      }

      const order = await this.orderService.updateOrderStatus(
        req.user,
        req.params.id as string,
        status
      );

      res.status(HttpCodes.Ok).json({
        success: true,
        message: "Order status updated successfully",
        data: order,
      });
    }
  );

  updateOrderPrice = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      if (!req.user) {
        throw new apiError(Errors.Unauthorized.code, Errors.Unauthorized.message);
      }

      const price = Number(req.body.price);
      if (Number.isNaN(price)) {
        throw new apiError(HttpCodes.BadRequest, "price must be a valid number");
      }

      const order = await this.orderService.updateOrderPrice(
        req.user,
        req.params.id as string,
        price
      );

      res.status(HttpCodes.Ok).json({
        success: true,
        message: "Order price updated successfully",
        data: order,
      });
    }
  );

  cancelOrder = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      if (!req.user) {
        throw new apiError(Errors.Unauthorized.code, Errors.Unauthorized.message);
      }

      const order = await this.orderService.cancelOrder(req.user, req.params.id as string);

      res.status(HttpCodes.Ok).json({
        success: true,
        message: "Order cancelled successfully",
        data: order,
      });
    }
  );

  addReview = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      if (!req.user) {
        throw new apiError(Errors.Unauthorized.code, Errors.Unauthorized.message);
      }

      const order = await this.orderService.addReview(
        req.user,
        req.params.id as string,
        req.body
      );

      res.status(HttpCodes.Ok).json({
        success: true,
        message: "Order review submitted successfully",
        data: order,
      });
    }
  );

  submitCompletionProof = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      if (!req.user) {
        throw new apiError(Errors.Unauthorized.code, Errors.Unauthorized.message);
      }

      const files = Array.isArray(req.files) ? req.files : [];
      const images = files
        .map((file) => (file as Express.Multer.File & { fileUrl?: string }).fileUrl)
        .filter((fileUrl): fileUrl is string => Boolean(fileUrl));

      const order = await this.orderService.submitCompletionProof(
        req.user,
        req.params.id as string,
        {
          images,
          note: req.body.note,
        }
      );

      res.status(HttpCodes.Ok).json({
        success: true,
        message: "Order completion proof submitted successfully",
        data: order,
      });
    }
  );

  deleteOrder = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      if (!req.user) {
        throw new apiError(Errors.Unauthorized.code, Errors.Unauthorized.message);
      }

      const order = await this.orderService.deleteOrder(req.user, req.params.id as string);

      res.status(HttpCodes.Ok).json({
        success: true,
        message: "Order deleted successfully",
        data: order,
      });
    }
  );

  markCheckpointReached = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      if (!req.user) {
        throw new apiError(Errors.Unauthorized.code, Errors.Unauthorized.message);
      }

      const order = await this.orderService.markCheckpointReached(
        req.user,
        req.params.id as string,
        req.body
      );

      res.status(HttpCodes.Ok).json({
        success: true,
        message: "Trip checkpoint updated successfully",
        data: order,
      });
    }
  );
}
