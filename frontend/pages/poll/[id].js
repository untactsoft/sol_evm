import { useRouter } from "next/router";
import dynamic from "next/dynamic";

const PollDetail = dynamic(() => import("../../components/PollDetail"), { ssr: false });

export default function PollPage() {
  const router = useRouter();
  const { id } = router.query;

  if (!id) return <div>페이지 ID를 불러오는 중...</div>;

  return <PollDetail id={id} />;
}
