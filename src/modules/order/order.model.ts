import { Schema, model, Types } from "mongoose";

const geoPointSchema = new Schema(
  {
    label: { type: String },
    addressLine: { type: String },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
  },
  { _id: false }
);

const routeCheckpointSchema = new Schema(
  {
    label: { type: String },
    addressLine: { type: String },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    sequence: { type: Number, required: true },
    reachedAt: { type: Date, default: null },
  },
  { timestamps: false }
);

const statusHistorySchema = new Schema(
  {
    status: {
      type: String,
      enum: [
        "Pending",
        "Accepted",
        "ArrivedPickup",
        "InProgress",
        "Completed",
        "Cancelled",
      ],
      required: true,
    },
    changedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    note: {
      type: String,
      trim: true,
    },
    changedBy: {
      type: Types.ObjectId,
      ref: "User",
      default: null,
    },
    actorRole: {
      type: String,
      enum: ["Admin", "User", "Rider"],
      required: true,
    },
  },
  { _id: false }
);

const orderReviewSchema = new Schema(
  {
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: "Rating must be a whole number from 1 to 5",
      },
    },
    comment: {
      type: String,
      trim: true,
    },
    reviewedAt: {
      type: Date,
      required: true,
    },
  },
  { _id: false }
);

const completionProofSchema = new Schema(
  {
    images: {
      type: [String],
      required: true,
      validate: {
        validator: (value: string[]) => Array.isArray(value) && value.length > 0,
        message: "At least one completion proof image is required",
      },
    },
    note: {
      type: String,
      trim: true,
    },
    submittedAt: {
      type: Date,
      required: true,
    },
    submittedBy: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    user: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    rider: {
      type: Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    pickup: {
      type: geoPointSchema,
      required: true,
    },
    dropoff: {
      type: geoPointSchema,
      required: true,
    },
    stoppages: {
      type: [routeCheckpointSchema],
      default: [],
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    originalPrice: {
      type: Number,
      min: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountType: {
      type: String,
      enum: ["ReferralFirstOrder"],
    },
    vehicleType: {
      type: String,
      enum: ["Bike", "Car", "Truck"],
      default: "Bike",
    },
    distanceKm: {
      type: Number,
      min: 0,
    },
    status: {
      type: String,
      enum: [
        "Pending",
        "Accepted",
        "ArrivedPickup",
        "InProgress",
        "Completed",
        "Cancelled",
      ],
      default: "Pending",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ["Unpaid", "Paid", "Refunded"],
      default: "Unpaid",
    },
    paymentMethod: {
      type: String,
      enum: ["Card", "Cash"],
      default: "Cash",
    },
    notes: {
      type: String,
      trim: true,
    },
    pickupReachedAt: {
      type: Date,
      default: null,
    },
    tripStartedAt: {
      type: Date,
      default: null,
    },
    dropoffReachedAt: {
      type: Date,
      default: null,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },
    review: {
      type: orderReviewSchema,
      default: null,
    },
    completionProof: {
      type: completionProofSchema,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Order = model("Order", orderSchema);

export default Order;
