import type { NextApiResponse } from "next";
import prisma from "@/prisma";
import Joi from "joi";
import { LANGUAGES } from "@/constants";
import { AuthenticatedRequest } from "../auth/utils";
import { createOrUpdateTags } from "../utils";
import { CodeTemplate } from "@prisma/client";
import { withAuth } from "../auth/middleware";

type Error = {
    error: string;
};

type Data = CodeTemplate;

const codeTemplateSchema = Joi.object({
    title: Joi.string().required(),
    description: Joi.string().required(),
    code: Joi.string().required(),
    language: Joi.string()
        .valid(...LANGUAGES)
        .required(),
    tags: Joi.array().items(Joi.string()).required(),
});

async function saveCodeTemplateInteractor(
    req: AuthenticatedRequest,
    res: NextApiResponse<Data | Error>
) {
    if (req.method !== "POST") {
        res.status(405).json({ error: `Method ${req.method} not allowed` });
        return;
    }
    const { error, value: validatedData } = codeTemplateSchema.validate(
        req.body
    );
    if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
    }
    const { title, description, code, language, tags } = validatedData;
    const user = req.user;

    // Create codeTemplateTags if they don't exist already
    const tagRecords = await createOrUpdateTags(tags, "codeTemplateTag");

    const codeTemplate = await prisma.codeTemplate.create({
        data: {
            title,
            description,
            code,
            language,
            tags: {
                connect: tagRecords.map((tag) => ({ id: tag.id })),
            },
            user: { connect: { id: Number(user.userId) } },
        },
    });

    res.status(201).json(codeTemplate);
    return;
}

export default withAuth(saveCodeTemplateInteractor);
