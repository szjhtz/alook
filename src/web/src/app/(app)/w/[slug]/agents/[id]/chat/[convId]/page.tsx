"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";

export default function AgentChatRedirect() {
  const params = useParams();
  const router = useRouter();
  const { slug } = useWorkspace();
  const agentId = params.id as string;

  useEffect(() => {
    router.replace(`/w/${slug}/agents/${agentId}/chat`);
  }, [router, slug, agentId]);

  return null;
}
