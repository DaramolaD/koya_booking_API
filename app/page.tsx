import { BookingSection } from "@/components/site/booking/booking-section";
import { Footer } from "@/components/site/footer";
import { Hero } from "@/components/site/hero";
import { MyBookings } from "@/components/site/my-bookings";

export default function Home() {
  return (
    <>
      <main id="top">
        <Hero />
        <BookingSection />
        <MyBookings />
      </main>
      <Footer />
    </>
  );
}
