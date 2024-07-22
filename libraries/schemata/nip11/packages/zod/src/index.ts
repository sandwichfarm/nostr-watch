import * as z from "zod";


export const AdmissionElementSchema = z.object({
    "amount": z.number().optional(),
    "kinds": z.array(z.number()).optional(),
    "period": z.number().optional(),
    "unit": z.string().optional(),
});
export type AdmissionElement = z.infer<typeof AdmissionElementSchema>;

export const LimitationSchema = z.object({
    "auth_required": z.boolean().optional(),
    "created_at_lower_limit": z.number().optional(),
    "created_at_upper_limit": z.number().optional(),
    "max_content_length": z.number().optional(),
    "max_event_tags": z.number().optional(),
    "max_filters": z.number().optional(),
    "max_limit": z.number().optional(),
    "max_message_length": z.number().optional(),
    "max_subid_length": z.number().optional(),
    "max_subscriptions": z.number().optional(),
    "min_pow_difficulty": z.number().optional(),
    "payment_required": z.boolean().optional(),
    "restricted_writes": z.boolean().optional(),
});
export type Limitation = z.infer<typeof LimitationSchema>;

export const RetentionElementSchema = z.object({
    "count": z.number().optional(),
    "kinds": z.array(z.union([z.array(z.number()), z.number()])).optional(),
    "time": z.number().optional(),
});
export type RetentionElement = z.infer<typeof RetentionElementSchema>;

export const FeesClassSchema = z.object({
    "admission": z.array(AdmissionElementSchema).optional(),
    "publication": z.array(AdmissionElementSchema).optional(),
    "subscription": z.array(AdmissionElementSchema).optional(),
});
export type FeesClass = z.infer<typeof FeesClassSchema>;

export const IndexSchema = z.object({
    "contact": z.string(),
    "description": z.string(),
    "fees": z.union([z.array(z.any()), z.boolean(), FeesClassSchema, z.number(), z.number(), z.null(), z.string()]).optional(),
    "icon": z.any().optional(),
    "language_tags": z.array(z.string()).optional(),
    "limitation": LimitationSchema.optional(),
    "name": z.string(),
    "payments_url": z.any().optional(),
    "posting_policy": z.any().optional(),
    "pubkey": z.string(),
    "relay_country": z.array(z.string()).optional(),
    "retention": z.array(RetentionElementSchema).optional(),
    "software": z.string(),
    "supported_nips": z.array(z.number()),
    "tags": z.array(z.string()).optional(),
    "version": z.string(),
});
export type Index = z.infer<typeof IndexSchema>;
