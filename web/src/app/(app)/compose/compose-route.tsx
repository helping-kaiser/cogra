"use client";

import { useSearchParams } from "next/navigation";

import { PostEditRoute } from "./post-edit-route";
import { ComposeWizard } from "./wizard/wizard-view";

export function ComposeRoute() {
  const params = useSearchParams();
  // `?reference=` prefills a citation on a NEW post, so it stays with the
  // wizard; only `?post=` names an existing post to edit.
  const post = params.get("post");
  return post === null ? <ComposeWizard /> : <PostEditRoute postId={post} />;
}
