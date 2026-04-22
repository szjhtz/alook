import { getSession } from "@/lib/session";
import { HomePage } from "@/components/home/home-page";
import { WorkspaceRedirect } from "@/components/workspace-redirect";

export default async function Page() {
  const session = await getSession();
  if (session) return <WorkspaceRedirect />;
  return <HomePage isLoggedIn={false} />;
}
