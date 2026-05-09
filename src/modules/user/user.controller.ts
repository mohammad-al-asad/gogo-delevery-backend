import { NextFunction, Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { logger } from "../../utils/logger";
import { UserService } from "./user.service";
import { HttpCodes } from "../../constants/status-codes";
import { apiError } from "../../errors/api-error";
import { Errors } from "../../constants/error-codes";
import { updateOtherRoleUserType } from "./user.type";
import {
  TypedRequestBody,
  TypedRequestBodyWithFile,
} from "../../types/request.type";
import {
  createUserType,
  saveAddressType,
  updateRiderLocationType,
} from "./user.type";

export class UserController {
  constructor(private userService: UserService) { }
  createUser = asyncHandler(
    async (
      req: TypedRequestBody<createUserType>,
      res: Response,
      next: NextFunction
    ) => {
      const body = req.body;
      logger.info({ user: req.user, body }, "Creating user");
      const user = await this.userService.createUser(body);
      res.status(HttpCodes.Ok).json({
        success: true,
        message: "User created successfully",
        data: user,
      });
    }
  );

  getAllUsers = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const query = req.query;
      const users = await this.userService.getAllUsers(query);
      res.status(HttpCodes.Ok).json({
        success: true,
        message: "All users fetched successfully",
        data: users.data,
        total: users.total,
        stats: users.stats,
      });
    }
  );

  getAllRiders = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const riders = await this.userService.getAllRiders(req.query);

      res.status(HttpCodes.Ok).json({
        success: true,
        message: "All riders fetched successfully",
        data: riders.data,
        total: riders.total,
        stats: riders.stats,
      });
    }
  );

  getUserById = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const id = req.params.id as string;
      const user = await this.userService.getUserById(id);
      res.status(HttpCodes.Ok).json({
        success: true,
        message: "User fetched successfully",
        data: user,
      });
    }
  );

  // getSalesReps=asyncHandler(async(req:Request,res:Response,next:NextFunction)=>{
  //   const salesReps=await this.userService.getSalesReps(req.query)
  //   res.status(HttpCodes.Ok).json({
  //       success:true,
  //       message:"Sales reps fetched successfully",
  //       data:salesReps.data,
  //       total:salesReps.total
  //   })
  // })

  deleteUser = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const id = req.params.id as string;
      const user = await this.userService.deleteUser(id);
      res.status(HttpCodes.Ok).json({
        success: true,
        message: "User deleted successfully",
        data: user,
      });
    }
  );

  getMyProfile = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const userId = req.user?.userId;
      if (!userId) {
        throw new apiError(Errors.NotFound.code, Errors.NotFound.message);
      }
      const user = await this.userService.getUserProfile(userId);
      res.status(HttpCodes.Ok).json({
        success: true,
        message: "User profile fetched successfully",
        data: user,
      });
    }
  );

  updateUser = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const id = req.params.id as string
      const body = req.body
      const user = await this.userService.updateUser(id, body)
      res.status(HttpCodes.Ok).json({
        success: true,
        message: "User updated successfully",
        data: user
      })
    }
  );

  updateMyProfile = asyncHandler(
    async (
      req: TypedRequestBodyWithFile<updateOtherRoleUserType>,
      res: Response,
      next: NextFunction
    ) => {
      const userId = req.user?.userId;
      const body = req.body;

      logger.info({ body }, "UserController.updateProfile")

      if (!userId) {
        throw new apiError(Errors.NotFound.code, Errors.NotFound.message);
      }

      // If a file is uploaded, attach its URL to the body
      if (req.file) {
        body.profileImage = req.file.fileUrl;
      }

      logger.info({ body }, "UserController.updateProfile")

      logger.info({ user: req.user, body }, "Updating user profile");

      const updatedUser = await this.userService.updateMyProfile(userId, body);

      res.status(HttpCodes.Ok).json({
        success: true,
        message: "Profile updated successfully",
        data: updatedUser,
      });
    }
  );

  updateMyDocuments = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const files = req.files && !Array.isArray(req.files) ? req.files : {};
      const body: Record<string, string> = {};

      const setDocumentUrl = (fieldName: string) => {
        const file = files[fieldName]?.[0] as (Express.Multer.File & { fileUrl?: string }) | undefined;
        if (file?.fileUrl) {
          body[fieldName] = file.fileUrl;
        }
      };

      setDocumentUrl("emaratesId");
      setDocumentUrl("drivingLicense");
      setDocumentUrl("vehicleRegistration");

      const updatedUser = await this.userService.updateMyDocuments(req.user, body);

      res.status(HttpCodes.Ok).json({
        success: true,
        message: "Documents updated successfully",
        data: updatedUser,
      });
    }
  );

  updateRiderLocation = asyncHandler(
    async (
      req: TypedRequestBody<updateRiderLocationType>,
      res: Response,
      _next: NextFunction
    ) => {
      const user = await this.userService.updateRiderLocation(req.user, req.body);

      res.status(HttpCodes.Ok).json({
        success: true,
        message: "Rider location updated successfully",
        data: {
          userId: user?._id,
          location: user?.location || null,
        },
      });
    }
  );

  getSavedAddresses = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const userId = req.user?.userId;

      if (!userId) {
        throw new apiError(Errors.NotFound.code, Errors.NotFound.message);
      }

      const addresses = await this.userService.getSavedAddresses(userId);

      res.status(HttpCodes.Ok).json({
        success: true,
        message: "Saved addresses fetched successfully",
        data: addresses,
      });
    }
  );

  addSavedAddress = asyncHandler(
    async (
      req: TypedRequestBody<saveAddressType>,
      res: Response,
      _next: NextFunction
    ) => {
      const userId = req.user?.userId;

      if (!userId) {
        throw new apiError(Errors.NotFound.code, Errors.NotFound.message);
      }

      const addresses = await this.userService.addSavedAddress(userId, req.body);

      res.status(HttpCodes.Created).json({
        success: true,
        message: "Address saved successfully",
        data: addresses,
      });
    }
  );

  updateSavedAddress = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const userId = req.user?.userId;

      if (!userId) {
        throw new apiError(Errors.NotFound.code, Errors.NotFound.message);
      }

      const addresses = await this.userService.updateSavedAddress(
        userId,
        req.params.addressId as string,
        req.body
      );

      res.status(HttpCodes.Ok).json({
        success: true,
        message: "Saved address updated successfully",
        data: addresses,
      });
    }
  );

  deleteSavedAddress = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
      const userId = req.user?.userId;

      if (!userId) {
        throw new apiError(Errors.NotFound.code, Errors.NotFound.message);
      }

      const addresses = await this.userService.deleteSavedAddress(
        userId,
        req.params.addressId as string
      );

      res.status(HttpCodes.Ok).json({
        success: true,
        message: "Saved address deleted successfully",
        data: addresses,
      });
    }
  );
}
