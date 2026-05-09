import { Router } from "express";
import { authMiddleware, orderController } from "../../container";
import { validate } from "../../middlewares/validate.middleware";
import { uploadFile } from "../../middlewares/upload.middleware";
import {
  AddOrderReviewSchema,
  AssignRiderSchema,
  CreateOrderSchema,
  EstimateOrderPriceSchema,
  MarkCheckpointSchema,
  SubmitCompletionProofSchema,
  UpdateOrderPriceSchema,
  UpdateOrderStatusSchema,
} from "./order.schema";

const orderRoute = Router();

orderRoute.use(authMiddleware.authenticate);

orderRoute.get("/summary", orderController.getOrderSummary);
orderRoute.post(
  "/estimate-price",
  validate(EstimateOrderPriceSchema),
  orderController.estimatePrice,
);
orderRoute.post("/", validate(CreateOrderSchema), orderController.createOrder);
orderRoute.get("/", orderController.getAllOrders);
orderRoute.get("/:id", orderController.getOrderById);

orderRoute.patch(
  "/:id/assign-rider",
  authMiddleware.authorize(["Admin", "Rider"]),
  // validate(AssignRiderSchema),
  orderController.assignRider,
);
orderRoute.patch(
  "/:id/status",
  validate(UpdateOrderStatusSchema),
  orderController.updateOrderStatus,
);
orderRoute.patch(
  "/:id/checkpoints",
  validate(MarkCheckpointSchema),
  orderController.markCheckpointReached,
);
orderRoute.patch(
  "/:id/price",
  authMiddleware.authorize(["Admin"]),
  validate(UpdateOrderPriceSchema),
  orderController.updateOrderPrice,
);
orderRoute.patch(
  "/:id/review",
  validate(AddOrderReviewSchema),
  orderController.addReview,
);
orderRoute.patch(
  "/:id/completion-proof",
  authMiddleware.authorize(["Rider"]),
  uploadFile({
    fieldName: "images",
    uploadType: "array",
    maxCount: 10,
    folder: "order-completion-proofs",
  }),
  validate(SubmitCompletionProofSchema),
  orderController.submitCompletionProof,
);
orderRoute.patch("/:id/cancel", orderController.cancelOrder);

orderRoute.delete(
  "/:id",
  authMiddleware.authorize(["Admin"]),
  orderController.deleteOrder,
);

export default orderRoute;
