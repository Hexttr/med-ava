import type { Metadata } from "next"

import { ReviewClient } from "./review-client"

export const metadata: Metadata = {
  title: "Оценка портретов",
  robots: {
    index: false,
    follow: false,
  },
}

export default function ReviewPage() {
  return <ReviewClient />
}
