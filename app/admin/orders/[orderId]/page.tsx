import { DetailPage } from '@/components/admin/detail-page';
export default async function OrderDetail({ params, searchParams }: { params: Promise<{orderId: string}>; searchParams: Promise<{tab?: string | string[]}> }) {
  const { orderId } = await params;
  return <DetailPage kind="orders" id={orderId} tab={(await searchParams).tab}/>;
}
