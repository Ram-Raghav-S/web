import type { NextApiResponse } from "next";
import prisma from "@/prisma";
import Joi from "joi";
import { AuthenticatedRequest } from "@/src/auth/utils";
import {
    MAX_CHARS_CONTENT,
    MAX_CHARS_TITLE_DESCRIPTION,
    MIN_CHARS,
    MAX_CHARS_TAG,
    LANGUAGES,
} from "../../../constants";
import { createOrUpdateTags } from "@/src/utils";
import { withAuth } from "@/src/auth/middleware";

type Error = {
    error: string;
};

type Data = {
    message: string;
};

const updateCodeTempateQuerySchema = Joi.object({
    id: Joi.number().integer().required(),
});

const updateCodeTemplateSchema = Joi.object({
    title: Joi.string().min(MIN_CHARS).max(MAX_CHARS_TITLE_DESCRIPTION),
    description: Joi.string().min(MIN_CHARS).max(MAX_CHARS_TITLE_DESCRIPTION),
    code: Joi.string().max(MAX_CHARS_CONTENT),
    language: Joi.string().valid(...LANGUAGES).optional(),
    tags: Joi.array().items(Joi.string().min(MIN_CHARS).max(MAX_CHARS_TAG)),
});

async function updateCodeTemplateInteractor(
    req: AuthenticatedRequest,
    res: NextApiResponse<Data | Error>
) {
    const { error: bodyError, value: bodyValue } =
        updateCodeTemplateSchema.validate(req.body);
    if (bodyError) {
        return res.status(400).json({ error: bodyError.details[0].message });
    }
    const { error: queryError, value: queryValue } =
        updateCodeTempateQuerySchema.validate(req.query);
    if (queryError) {
        return res.status(400).json({ error: queryError.details[0].message });
    }

    const userId = Number(req.user.userId);

    try {
        const { title, description, code, tags, language } = bodyValue; 
        const { id } = queryValue;
        const existingCodeTemplate = await prisma.codeTemplate.findUnique({
            where: { id },
        });
        if (!existingCodeTemplate) {
            return res.status(404).json({ error: "Code template not found" });
        }
        if (existingCodeTemplate.userId !== userId) {
            return res.status(403).json({ error: "Forbidden" });
        }

        // Build the data object dynamically
        const data: any = {};

        if (title !== undefined) data.title = title;
        if (description !== undefined) data.description = description;
        if (code !== undefined) data.code = code;
        if (language !== undefined) data.language = language; // Add language

        if (tags !== undefined) {
            const tagRecords = await createOrUpdateTags(
                tags,
                "codeTemplateTag"
            );
            data.tags = {
                set: tagRecords.map((tag) => ({ id: tag.id })),
            };
        }

        await prisma.codeTemplate.update({
            where: { id },
            data: data,
        });
        return res
            .status(200)
            .json({ message: "Code Template Updated Successfully." });
    } catch (error) {
        console.error("Error updating code template:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

export default withAuth(updateCodeTemplateInteractor);
