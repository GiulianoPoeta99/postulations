import { listApplications } from "@/lib/db";
import { PostulacionesClientView } from "./ClientView";

export const dynamic = "force-dynamic";

export default function PostulacionesPage() {
  const applications = listApplications();

  return <PostulacionesClientView applications={applications} />;
}
