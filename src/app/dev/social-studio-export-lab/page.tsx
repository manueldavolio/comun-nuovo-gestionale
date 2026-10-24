import { notFound } from "next/navigation";
import { SocialStudioExportLab } from "@/components/social-studio/export-lab";

/**
 * Preview isolata SOLO in development: esegue il reale toPng sui canvas Social Studio.
 * Fuori dal matcher middleware /social, per evitare blocchi auth durante la verifica locale.
 */
export default function SocialStudioExportLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <SocialStudioExportLab />;
}
