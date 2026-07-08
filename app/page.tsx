import { PostulacionesClient } from "@/app/postulaciones-client";
import { listApplications } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function Home() {
  const applications = listApplications();

  return <PostulacionesClient applications={applications} />;
}
