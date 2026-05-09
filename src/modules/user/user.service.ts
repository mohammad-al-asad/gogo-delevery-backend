import { UserRepository } from "./user.repository";
import { apiError } from "../../errors/api-error";
import { Errors } from "../../constants/error-codes";
import {
  createUserType,
  saveAddressType,
  updateRiderLocationType,
  updateSavedAddressType,
} from "./user.type";

export class UserService {
  constructor(private userRepo: UserRepository) {}

  createUser = async (userBody: createUserType) => {
    const existingUser = await this.userRepo.findUserByEmail(userBody.email);

    if (existingUser) {
      throw new apiError(
        Errors.AlreadyExists.code,
        "User already exists with this email"
      );
    }
    return await this.userRepo.createUser(userBody);
  };

  getUserProfile = async (id: string) => {
    return await this.userRepo.findUserById(id);
  };

  getAllUsers = async (query: any) => {
    const [users, stats] = await Promise.all([
      this.userRepo.getAllUsers(query),
      this.userRepo.getUserStats(),
    ]);

    return {
      ...users,
      stats,
    };
  };

  getAllRiders = async (query: any) => {
    const [riders, stats] = await Promise.all([
      this.userRepo.getAllRiders(query),
      this.userRepo.getRiderStats(),
    ]);

    return {
      ...riders,
      stats,
    };
  };

  getUserById = async (id: string) => {
    return await this.userRepo.findUserById(id)
  }

  updateMyProfile = async (id: string, body: any) => {
    return await this.userRepo.updateMyProfile(id, body);
  };

  updateMyDocuments = async (currentUser: any, body: any) => {
    if (!currentUser?.userId) {
      throw new apiError(Errors.Unauthorized.code, Errors.Unauthorized.message);
    }

    const user = await this.userRepo.findUserById(currentUser.userId);

    if (!user) {
      throw new apiError(Errors.NotFound.code, Errors.NotFound.message);
    }

    if (user.role !== "Rider") {
      throw new apiError(Errors.Forbidden.code, "Only riders can update documents");
    }

    if (Object.keys(body).length === 0) {
      throw new apiError(400, "At least one document is required");
    }

    return await this.userRepo.updateMyProfile(currentUser.userId, body);
  };

  updateRiderLocation = async (currentUser: any, body: updateRiderLocationType) => {
    if (!currentUser?.userId) {
      throw new apiError(Errors.Unauthorized.code, Errors.Unauthorized.message);
    }

    const user = await this.userRepo.findUserById(currentUser.userId);

    if (!user) {
      throw new apiError(Errors.NotFound.code, Errors.NotFound.message);
    }

    if (user.role !== "Rider") {
      throw new apiError(Errors.Forbidden.code, "Only riders can update location");
    }

    if (user.status !== "Approved") {
      const message =
        user.status === "Blocked"
          ? "Rider account is blocked"
          : "Rider account is pending admin approval";

      throw new apiError(Errors.Forbidden.code, message);
    }

    return await this.userRepo.updateUserLocation(currentUser.userId, {
      latitude: body.latitude,
      longitude: body.longitude,
      updatedAt: new Date(),
    });
  };

  updateUser = async (id: string, body: any) => {
    const existingUser = await this.userRepo.findUserById(id);

    if (!existingUser) {
      throw new apiError(Errors.NotFound.code, Errors.NotFound.message);
    }

    if (body.status) {
      if (existingUser.role === "Admin") {
        throw new apiError(400, "Admin account status cannot be updated here");
      }

      if (!["Pending", "Approved", "Blocked"].includes(body.status)) {
        throw new apiError(400, "Invalid user status");
      }

      if (existingUser.role === "User" && body.status === "Pending") {
        throw new apiError(400, "Pending status is only valid for rider accounts");
      }
    }

    return await this.userRepo.updateUser(id, body)
  }

  // getSalesReps = async (query: any) => {
  //   return await this.userRepo.getSalesReps(query)
  // }
  deleteUser = async (id: string) => {
    return await this.userRepo.deleteUser(id)
  }

  getSavedAddresses = async (id: string) => {
    const user = await this.userRepo.findUserById(id);

    if (!user) {
      throw new apiError(Errors.NotFound.code, Errors.NotFound.message);
    }

    return user.savedAddresses || [];
  };

  addSavedAddress = async (id: string, body: saveAddressType) => {
    if (body.isDefault) {
      await this.userRepo.clearDefaultSavedAddresses(id);
    }

    const user = await this.userRepo.addSavedAddress(id, body);

    if (!user) {
      throw new apiError(Errors.NotFound.code, Errors.NotFound.message);
    }

    return user.savedAddresses;
  };

  updateSavedAddress = async (
    id: string,
    addressId: string,
    body: updateSavedAddressType
  ) => {
    if (body.isDefault) {
      await this.userRepo.clearDefaultSavedAddresses(id);
    }

    const user = await this.userRepo.updateSavedAddress(id, addressId, body);

    if (!user) {
      throw new apiError(Errors.NotFound.code, "Saved address not found");
    }

    return user.savedAddresses;
  };

  deleteSavedAddress = async (id: string, addressId: string) => {
    const existingUser = await this.userRepo.findUserById(id);

    if (!existingUser) {
      throw new apiError(Errors.NotFound.code, Errors.NotFound.message);
    }

    const addressExists = (existingUser.savedAddresses || []).some(
      (address: any) => String(address._id) === addressId
    );

    if (!addressExists) {
      throw new apiError(Errors.NotFound.code, "Saved address not found");
    }

    const user = await this.userRepo.removeSavedAddress(id, addressId);

    return user?.savedAddresses || [];
  };
}
