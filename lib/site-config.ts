// Images live in public/image. Set an image to null to use the gradient fallback.

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
  hero: {
    src: "/image/hero.webp",
    alt: "A bright, quiet treatment room with a large window and soft daylight",
  },
};
