import { Schema, model } from "mongoose";

const savedAddressSchema = new Schema(
  {
    label: {
      type: String,
      trim: true,
    },
    addressLine: {
      type: String,
      required: true,
      trim: true,
    },
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const userSchema = new Schema(
  {
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      index: true,
      unique: true,
    },
    password: {
      type: String,
      select: false,
    },
    profileImage: {
      type: String,
      trim: true,
    },
    companyName: {
      type: String,
    },
    trnVatNo: {
      type: String,
    },
    referralCode: {
      type: String,
      index: true,
      unique: true,
      sparse: true,
      uppercase: true,
      trim: true,
    },
    referredByReferralCode: {
      type: String,
      uppercase: true,
      trim: true,
    },
    referralDiscountUsed: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      required: true,
      enum: ["Admin", "User", "Rider"],
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Blocked"],
      default: function (this: any) {
        return this.role === "Rider" ? "Pending" : "Approved";
      },
      index: true,
    },
    emaratesId: {
      type: String,
      required: function (this: any) {
        return this.role === "Rider";
      },
    },
    drivingLicense: {
      type: String,
      required: function (this: any) {
        return this.role === "Rider";
      },
    },
    vehicleRegistration: {
      type: String,
      trim: true,
    },
    location: {
      latitude: { type: Number },
      longitude: { type: Number },
      updatedAt: { type: Date },
    },
    savedAddresses: {
      type: [savedAddressSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.password;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.password;
        return ret;
      },
    },
  }
);

const User = model("User", userSchema);

export default User;
