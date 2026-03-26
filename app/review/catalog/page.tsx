import type { Metadata } from "next"

import { ReviewCatalogClient } from "./review-catalog-client"

export const metadata: Metadata = {
  title: "Каталог оценки портретов",
  robots: {
    index: false,
    follow: false,
  },
}

export default function ReviewCatalogPage() {
  return <ReviewCatalogClient />
}
