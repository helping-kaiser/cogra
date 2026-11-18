import type { Metadata } from "next";

import { joinLayerOf } from "@/lib/onboarding/join-origin";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in — CoGra" };

type Props = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : null);

export default async function LoginPage({ searchParams }: Props) {
  const { from, invite, door } = await searchParams;
  return <LoginForm joinLayer={joinLayerOf({ from: one(from), invite: one(invite), door: one(door) })} />;
}
