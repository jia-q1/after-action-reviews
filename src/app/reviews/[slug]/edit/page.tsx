import ReviewEditWorkspace from "./review-edit-workspace";

export default async function ReviewEditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ReviewEditWorkspace slug={slug} />;
}
