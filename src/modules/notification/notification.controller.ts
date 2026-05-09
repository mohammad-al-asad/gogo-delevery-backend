import { NextFunction, Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { HttpCodes } from "../../constants/status-codes";
import { NotificationService } from "./notification.service";

export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  getMyNotifications = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const notifications = await this.notificationService.getMyNotifications(req.user);

      res.status(HttpCodes.Ok).json({
        success: true,
        message: "Notifications fetched successfully",
        data: notifications,
      });
    }
  );

  markAsRead = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const notification = await this.notificationService.markAsRead(
        req.user,
        req.params.id as string
      );

      res.status(HttpCodes.Ok).json({
        success: true,
        message: "Notification marked as read",
        data: notification,
      });
    }
  );

  markAllAsRead = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const notifications = await this.notificationService.markAllAsRead(req.user);

      res.status(HttpCodes.Ok).json({
        success: true,
        message: "All notifications marked as read",
        data: notifications,
      });
    }
  );
}
