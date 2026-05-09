import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { apiError } from "../errors/api-error";
import { formatZodError } from "../errors/zodErrorFormatter";
import { logger } from "../utils/logger";
import { TokenExpiredError } from "jsonwebtoken";
import mongoose from "mongoose";
import { formatForLog } from "../utils/log-format";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let message: any;
  let statusCode: number;

  if (err instanceof ZodError) {
    statusCode = 400;
    message = formatZodError(err);
  } else if (
    err instanceof SyntaxError &&
    "status" in err &&
    (err as SyntaxError & { status?: number }).status === 400 &&
    "body" in err
  ) {
    statusCode = 400;
    message = "Invalid JSON in request body";
  } else if (err instanceof apiError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof TokenExpiredError) {
    statusCode = 401;
    message = "Token expired";
  } else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    message = err.message;
  } else {
    statusCode = 500;
    message = "Internal server error";
  }

  const errorResponse = { success: false, message };

  logger.error(
    {
      err,
      method: req.method,
      route: req.originalUrl,
      body: formatForLog(req.body ?? {}),
      error: formatForLog(errorResponse),
      statusCode,
    },
    "Request failed",
  );

  return res.status(statusCode).json(errorResponse);
};
