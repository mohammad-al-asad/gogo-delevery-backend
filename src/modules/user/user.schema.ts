import { z } from "zod";

const BaseUserSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phoneNumber: z.string().min(1),
  email: z.email(),
  profileImage: z.string().optional(),
  companyName: z.string().optional(),
  trnVatNo: z.string().optional(),
  role: z.enum(["Admin", "User", "Rider"]),
  emaratesId: z.string().optional(),
  drivingLicense: z.string().optional(),
  vehicleRegistration: z.string().optional(),
});

export const CreateUserSchema = BaseUserSchema.superRefine((data, ctx) => {
  if (data.role === "Rider") {
    if (!data.emaratesId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Emarates ID is required for Rider",
        path: ["emaratesId"],
      });
    }
    if (!data.drivingLicense) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Driving license is required for Rider",
        path: ["drivingLicense"],
      });
    }
  }
});

export const UpdateUserSchemaForOtherRoles = BaseUserSchema.omit({
  role: true,
}).partial();

export const SaveAddressSchema = z.object({
  label: z.string().trim().optional(),
  addressLine: z.string().trim().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  isDefault: z.boolean().optional(),
});

export const UpdateSavedAddressSchema = SaveAddressSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  {
    message: "At least one field is required",
  }
);

export const UpdateRiderLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
