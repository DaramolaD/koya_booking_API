// Image hosts must be allowed in next.config.ts (no query strings).
// Set an image to null to use the gradient fallback.

export const SITE = {
  name: "Fernwell Clinic",
  email: "hello@fernwell.example",
  phone: "+00 000 000 0000",
  address: "12 Linden Row",
  hours: [
    { days: "Monday – Friday", time: "08:00 – 18:00" },
    { days: "Saturday", time: "09:00 – 13:00" },
    { days: "Sunday", time: "Closed" },
  ],
} as const;

export type SiteImage = { src: string; alt: string } | null;

export const IMAGES: { hero: SiteImage } = {
  // Unsplash, free to use under the Unsplash License.
  hero: {
    src: "https://images.unsplash.com/photo-1629909613654-28e377c37b09",
    alt: "A bright, quiet treatment room with a large window and soft daylight",
  },
  // Alternative: a doctor talking a patient through their results.
  // src: "https://images.unsplash.com/photo-1666214280557-f1b5022eb634",
};
