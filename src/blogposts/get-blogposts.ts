import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/prisma";
import Joi from "joi";
import { Prisma } from "@prisma/client";
import { withOptionalAuth } from "../auth/middleware";
import { OptionallyAuthenticatedRequest } from "../auth/utils";

type Error = {
    error: string;
};

type Data = {
    posts: any[];
    total: number;
    page: number;
    pageSize: number;
};

const getBlogPostsSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    pageSize: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().allow(""),
    tags: Joi.array().single().items(Joi.string()),
    sortBy: Joi.string().valid("valued", "controversial", ''),
    showMyBlogPosts: Joi.boolean().default(false),
});

async function handler(
    req: OptionallyAuthenticatedRequest,
    res: NextApiResponse<Data | Error>
) {
    if (req.method !== "GET") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }

    try {
        const { value, error } = getBlogPostsSchema.validate(req.query);
        if (error) {
            res.status(400).json({ error: error.details[0].message });
            return;
        }

        const { page, pageSize, search, tags, sortBy } = value;

        const userId = req.user ? Number(req.user.userId) : null;

        if (userId == null && value.showMyBlogPosts) {
            res.status(403).json({ error: "Unauthenticated user cannot own blogposts" });
            return;
        }

        // Construct the 'where' clause based on the filters
    let where: Prisma.BlogPostWhereInput;
        if (userId !== null) {
            const isAdmin = req.user?.isAdmin || false;
            where = {
                OR: [
                    { isHidden: false },
                    { AND: [{ isHidden: true }, { userId: userId }] },
                    ...(isAdmin ? [{ isHidden: true }] : []),
                ],
            };
            if (value.showMyBlogPosts) {
                where.userId = userId;
            }
        } else {
            // If not authenticated, only fetch comments that are not hidden
            where = {
                isHidden: false,
            };
        };

        // Handle search filtering
        if (search) {
            if (!where.OR) {
                where.OR = [];
            }
            where.OR.push(
                { title: { contains: search } },
                { content: { contains: search } },
                { description: { contains: search } },
            )
        }

        // Handle tags filtering
        if (tags && tags.length > 0) {
            where.tags = {
                some: {
                    name: {
                        in: tags,
                    },
                },
            };
        }

        // Calculate pagination parameters
        const skip = (page - 1) * pageSize;
        const take = pageSize;

        // Handle sorting
        let orderBy: any = { postedAt: "desc" };

        if (sortBy === "valued") {
            orderBy = [{ upvotes: "desc" }, { downvotes: "asc" }];
        } else if (sortBy === "controversial") {
            orderBy = [{ upvotes: "desc" }, { downvotes: "desc" }];
        }

        // Fetch the total count for pagination
        const total = await prisma.blogPost.count({ where });

        // Fetch the blog posts with pagination, filtering, and sorting
        const posts = await prisma.blogPost.findMany({
            where,
            include: {
                tags: true,
                user: true,
            },
            skip,
            take,
            orderBy,
        });

        res.status(200).json({
            posts,
            total,
            page,
            pageSize,
        });
        return;
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error" });
        return;
    }
}

export default withOptionalAuth(handler);