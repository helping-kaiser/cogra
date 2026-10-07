import type { Metadata } from "next";

import { ApplicantEmailView } from "./applicant-email-view";

export const metadata: Metadata = { title: "Change your email — CoGra" };

export default function ApplicantEmailPage() {
  return <ApplicantEmailView />;
}
