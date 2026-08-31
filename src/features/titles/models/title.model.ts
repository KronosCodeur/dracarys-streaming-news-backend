import { Schema, model, type InferSchemaType } from "mongoose";

export const MEDIA_TYPES = ["movie", "tv"] as const;
export const PROVIDERS = ["netflix", "prime_video"] as const;

export type MediaType = (typeof MEDIA_TYPES)[number];
export type Provider = (typeof PROVIDERS)[number];

const titleSchema = new Schema(
  {
    tmdbId: { type: Number, required: true },
    mediaType: { type: String, enum: MEDIA_TYPES, required: true },
    provider: { type: String, enum: PROVIDERS, required: true },
    title: { type: String, required: true },
    overview: { type: String, default: "" },
    genres: { type: [String], default: [] },
    releaseDate: { type: Date, default: null },
    posterUrl: { type: String, default: null },
    backdropUrl: { type: String, default: null },
    popularity: { type: Number, default: 0 },
  },
  { timestamps: true },
);

titleSchema.index({ tmdbId: 1, mediaType: 1, provider: 1 }, { unique: true });
titleSchema.index({ provider: 1, mediaType: 1, releaseDate: -1 });
titleSchema.index({ provider: 1, mediaType: 1, popularity: -1 });
titleSchema.index({ genres: 1 });

export type TitleDocument = InferSchemaType<typeof titleSchema>;

export const TitleModel = model("Title", titleSchema);
