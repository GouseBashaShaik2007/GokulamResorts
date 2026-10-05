import TableQrCodes from '@/components/admin/TableQrCodes';
import PageHeader from '@/components/ui/PageHeader';

export const metadata = { title: 'QR Codes' };

export default function AdminQrCodesPage() {
  return (
    <div>
      <PageHeader size="section" eyebrow="Dine-In" title="QR Codes" className="mb-8 no-print" />
      <TableQrCodes />
    </div>
  );
}
