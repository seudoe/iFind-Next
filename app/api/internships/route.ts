import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Internship from "@/models/Internship";

export async function GET(req: NextRequest) {
    try {
        await connectDB();

        const { searchParams } = new URL(req.url);
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
        const limit = Math.min(50, parseInt(searchParams.get("limit") || "12"));
        const skip = (page - 1) * limit;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const filter: Record<string, any> = {
            isActive: true,
            $or: [
                { "moderation.status": { $exists: false } }, // backward compat
                { "moderation.status": "auto_approved" },
                { "moderation.status": "manually_approved" },
            ],
        };

        const stipendType = searchParams.get("stipendType");
        if (stipendType) filter["stipend.type"] = stipendType;

        const stipendMin = searchParams.get("stipendMin");
        const stipendMax = searchParams.get("stipendMax");
        if (stipendMin || stipendMax) {
            filter["stipend.amount"] = {};
            if (stipendMin)
                filter["stipend.amount"].$gte = parseInt(stipendMin);
            if (stipendMax)
                filter["stipend.amount"].$lte = parseInt(stipendMax);
        }

        if (searchParams.get("remote") === "true") filter.isRemote = true;

        const locations = searchParams
            .getAll("location")
            .filter((l) => l !== "Work from Home");
        if (locations.length > 0) filter.city = { $in: locations };

        const durationMin = searchParams.get("durationMin");
        const durationMax = searchParams.get("durationMax");
        if (durationMin || durationMax) {
            filter["duration.value"] = {};
            if (durationMin)
                filter["duration.value"].$gte = parseInt(durationMin);
            if (durationMax)
                filter["duration.value"].$lte = parseInt(durationMax);
        }

        const skills = searchParams.getAll("skill");
        if (skills.length > 0) filter.skills = { $in: skills };

        const companies = searchParams.getAll("company");
        if (companies.length > 0) filter.company = { $in: companies };

        const perks = searchParams.getAll("perk");
        if (perks.length > 0) filter.perks = { $all: perks };

        const q = searchParams.get("q");
        if (q) {
            // Use $and to avoid overwriting the moderation status $or
            filter.$and = [
                {
                    $or: [
                        { name: { $regex: q, $options: "i" } },
                        { company: { $regex: q, $options: "i" } },
                        { skills: { $regex: q, $options: "i" } },
                    ],
                },
            ];
        }

        const sortBy = searchParams.get("sortBy") || "latest";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sort: Record<string, any> =
            sortBy === "stipend"
                ? { "stipend.amount": -1 }
                : sortBy === "deadline"
                  ? { deadlineDate: 1 }
                  : { datePublished: -1 };

        const [docs, total] = await Promise.all([
            Internship.find(filter).sort(sort).skip(skip).limit(limit).lean(),
            Internship.countDocuments(filter),
        ]);

        return NextResponse.json({
            success: true,
            data: JSON.parse(JSON.stringify(docs)),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    } catch (err) {
        console.error("[internships GET]", err);
        return NextResponse.json(
            { success: false, error: "Server error" },
            { status: 500 },
        );
    }
}
