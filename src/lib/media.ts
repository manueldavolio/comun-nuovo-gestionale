import type { MediaType } from "@/generated/prisma/enums";

export const MEDIA_TYPE_CHOICES: Array<{ value: MediaType; label: string }> = [
  { value: "PHOTO", label: "Foto" },
  { value: "VIDEO", label: "Video" },
];

export const MEDIA_TYPE_LABEL: Record<MediaType, string> = {
  PHOTO: "Foto",
  VIDEO: "Video",
};
