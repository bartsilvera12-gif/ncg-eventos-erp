export const dynamic = "force-dynamic";

import CampanasDetailClient from "./CampanasDetailClient";

type PageProps = { params: Promise<{ id: string }> };

export default async function CampanaDetallePage({ params }: PageProps) {
  const { id } = await params;
  return <CampanasDetailClient campaignId={id} />;
}