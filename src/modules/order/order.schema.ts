import { z } from "zod";

const geoPointSchema = z.object({
  label: z.string().trim().optional(),
  addressLine: z.string().trim().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const CreateOrderSchema = z.object({
  user: z.string().optional(),
  rider: z.string().optional(),
  pickup: geoPointSchema,
  dropoff: geoPointSchema,
  stoppages: z.array(geoPointSchema).optional().default([]),
  price: z.number().min(0),
  distanceKm: z.number().min(0).optional(),
  paymentStatus: z.enum(["Unpaid", "Paid", "Refunded"]).optional(),
  paymentMethod: z.enum(["Card", "Cash"]).optional(),
  vehicleType: z.enum(["Bike", "Car", "Truck"]).optional(),
  notes: z.string().trim().optional(),
});

export const EstimateOrderPriceSchema = z.object({
  distanceKm: z.number().min(0),
  durationMin: z.number().min(0),
  vehicleType: z.enum(["Bike", "Car", "Truck"]),
});

export const AssignRiderSchema = z.object({
  riderId: z.string().min(1).optional(),
});

export const UpdateOrderStatusSchema = z.object({
  status: z.enum([
    "Pending",
    "Accepted",
    "ArrivedPickup",
    "InProgress",
    "Completed",
    "Cancelled",
  ]),
});

export const UpdateOrderPriceSchema = z.object({
  price: z.number().min(0),
});

export const AddOrderReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().optional(),
});

export const SubmitCompletionProofSchema = z.object({
  note: z.string().trim().optional(),
});

export const MarkCheckpointSchema = z
  .object({
    pointType: z.enum(["pickup", "stoppage", "dropoff"]),
    stoppageId: z.string().optional(),
    note: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.pointType === "stoppage" && !data.stoppageId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["stoppageId"],
        message: "stoppageId is required when pointType is stoppage",
      });
    }
  });
