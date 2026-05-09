import multer from "multer";
import { Request, Response, NextFunction } from "express";
import path from "path";
import crypto from "crypto";
import { uploadToS3 } from "../utils/s3-upload";

type UploadType = "single" | "array" | "fields";

type UploadField = {
    name: string;
    maxCount?: number;
};

interface UploadOptions {
    fieldName?: string;
    fields?: UploadField[];
    maxSizeMB?: number;
    uploadType?: UploadType;
    maxCount?: number;
    folder?: string; // optional S3 folder
}

export const uploadFile = ({
    fieldName,
    fields,
    maxSizeMB = 5,
    uploadType = "single",
    maxCount = 10,
    folder = "uploads",
}: UploadOptions) => {
    if (!fieldName && (!fields || fields.length === 0)) {
        throw new Error("fieldName or fields is required for file upload");
    }

    const multerInstance = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: maxSizeMB * 1024 * 1024 },
    });

    let uploader: any;

    switch (uploadType) {
        case "single":
            if (!fieldName) throw new Error("fieldName is required for single upload");
            uploader = multerInstance.single(fieldName);
            break;
        case "array":
            if (!fieldName) throw new Error("fieldName is required for array upload");
            uploader = multerInstance.array(fieldName, maxCount);
            break;
        case "fields":
            uploader = multerInstance.fields(
                fields || [{ name: fieldName as string, maxCount }],
            );
            break;
        default:
            if (!fieldName) throw new Error("fieldName is required for single upload");
            uploader = multerInstance.single(fieldName);
    }

    return async (req: Request, res: Response, next: NextFunction) => {
        uploader(req, res, async (err: any) => {
            if (err) return next(err);

            try {
                /** SINGLE FILE */
                if (req.file) {
                    // const ext = path.extname(req.file.originalname);
                    // const key = `${folder}/${crypto.randomUUID()}${ext}`;
                    const key = `${folder}/${req.file.originalname}`;

                    const fileUrl = await uploadToS3(
                        req.file.buffer,
                        key,
                        req.file.mimetype,
                    );

                    (req.file as any).fileUrl = fileUrl;
                }

                /** MULTIPLE FILES (array) */
                if (Array.isArray(req.files)) {
                    for (const file of req.files) {
                        // const ext = path.extname(file.originalname);
                        // const key = `${folder}/${crypto.randomUUID()}${ext}`;
                        const key = `${folder}/${file.originalname}`;

                        file.fileUrl = await uploadToS3(
                            file.buffer,
                            key,
                            file.mimetype,
                        );
                    }
                }

                /** MULTIPLE FILES (fields) */
                if (req.files && !Array.isArray(req.files)) {
                    for (const fileArray of Object.values(req.files)) {
                        for (const file of fileArray as any[]) {
                            // const ext = path.extname(file.originalname);
                            // const key = `${folder}/${crypto.randomUUID()}${ext}`;
                            const key = `${folder}/${file.originalname}`;

                            file.fileUrl = await uploadToS3(
                                file.buffer,
                                key,
                                file.mimetype,
                            );
                        }
                    }
                }

                next();
            } catch (error) {
                next(error);
            }
        });
    };
};
