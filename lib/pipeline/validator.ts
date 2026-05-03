import { z } from "zod";
import type { Internship } from "@/types";

// URL regex — basic but covers http/https
const URL_REGEX = /^https?:\/\/.+\..+/i;

const InternshipValidationSchema = z.object({
    name: z.string().min(1, "name is required"),
    company: z.string().min(1, "company is required"),
    applyLink: z
        .string()
        .min(1, "applyLink is required")
        .regex(URL_REGEX, "applyLink must be a valid URL"),
    summary: z.string().min(1, "summary is required"),
    stipend: z
        .object({
            type: z.enum(["paid", "unpaid", "performance-based"], {
                errorMap: () => ({
                    message:
                        "stipend.type must be paid, unpaid, or performance-based",
                }),
            }),
            amount: z.number().min(0).nullable().optional(),
            currency: z.string().nullable().optional(),
            period: z
                .enum(["monthly", "weekly", "lump-sum"])
                .nullable()
                .optional(),
        })
        .superRefine((stipend, ctx) => {
            if (
                stipend.type === "paid" &&
                (stipend.amount === null || stipend.amount === undefined)
            ) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message:
                        "stipend.amount is required when stipend.type is paid",
                    path: ["amount"],
                });
            }
        }),
    duration: z.object({
        value: z
            .number()
            .min(1, "duration.value must be at least 1")
            .max(52, "duration.value must be at most 52"),
        unit: z.enum(["weeks", "months"], {
            errorMap: () => ({
                message: "duration.unit must be weeks or months",
            }),
        }),
    }),
});

export function validateInternship(
    data: Partial<Internship>,
): { valid: true; data: Internship } | { valid: false; errors: string[] } {
    const result = InternshipValidationSchema.safeParse(data);

    if (!result.success) {
        const errors = result.error.issues.map(
            (issue) => `${issue.path.join(".") || "root"}: ${issue.message}`,
        );
        return { valid: false, errors };
    }

    // Merge validated required fields back with the rest of the partial data
    const merged = {
        ...data,
        ...result.data,
    } as Internship;

    return { valid: true, data: merged };
}
