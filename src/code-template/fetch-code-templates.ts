import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/prisma";
import Joi from "joi";
import { Prisma } from "@prisma/client";
import { formatTags } from "../utils";
import {
  MAX_CHARS_CONTENT,
  MAX_CHARS_TITLE_DESCRIPTION,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
  MIN_PAGES,
  PAGE_SIZE,
} from "../../constants";
import { AuthenticatedRequest } from "../auth/utils";

type Error = {
  error: string;
};

type CodeTemplateData = {
  codeTemplates: any[];
  total: number;
  page: number;
  pageSize: number;
};

const getCodeTemplatesSchema = Joi.object({
  page: Joi.number().integer().min(MIN_PAGES).default(MIN_PAGES),
  pageSize: Joi.number()
    .integer()
    .min(MIN_PAGE_SIZE)
    .max(MAX_PAGE_SIZE)
    .default(PAGE_SIZE),
  tags: Joi.array().single().items(Joi.string()).optional(),
  title: Joi.string().max(MAX_CHARS_TITLE_DESCRIPTION).optional().allow(""),
  code: Joi.string().max(MAX_CHARS_CONTENT).optional().allow(""),
  description: Joi.string().optional().allow(""),
  userId: Joi.number().integer().optional(),
});

async function getCodeTemplatesInteractor(
  req: AuthenticatedRequest | NextApiRequest,
  res: NextApiResponse<CodeTemplateData | Error>
) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { value, error } = getCodeTemplatesSchema.validate(req.query);
    if (error) {
      res.status(400).json({ error: error.details[0].message });
      return;
    }

    const { page, pageSize, title, code, description } = value;
    let { tags, userId } = value;

    // Ensure `tags` is an array regardless of how it's provided
    tags = formatTags(tags);

    // Construct OR conditions for title, code, description, userId
    const orConditions: Prisma.CodeTemplateWhereInput[] = [];

    if (title) {
      orConditions.push({ title: { contains: title } });
    }

    if (code) {
      orConditions.push({ code: { contains: code } });
    }

    if (description) {
      orConditions.push({ description: { contains: description } });
    }

    if (userId) {
      orConditions.push({ userId: userId });
    }

    // Build the filter with tags as an AND condition and others as OR
    const filter: Prisma.CodeTemplateWhereInput = {
      ...(tags.length > 0 && { tags: { some: { name: { in: tags } } } }),
      ...(orConditions.length > 0 && { OR: orConditions }),
    };

    // Calculate pagination parameters
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // Fetch the total count of code templates for pagination
    const total = await prisma.codeTemplate.count({ where: filter });

    // Fetch the code templates with pagination and filtering
    const codeTemplates = await prisma.codeTemplate.findMany({
      where: filter,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarId: true,
          },
        },
        tags: {
          select: {
            name: true,
          },
        },
      },
      skip,
      take,
    });

    return res.status(200).json({
      codeTemplates,
      total,
      page,
      pageSize,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

export default getCodeTemplatesInteractor;
