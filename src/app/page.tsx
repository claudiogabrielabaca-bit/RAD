import { Suspense } from "react";
import HomePageClient from "./home-page-client";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <HomePageClient />
    </Suspense>
  );
}
