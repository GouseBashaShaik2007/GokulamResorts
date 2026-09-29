import TableQrCodes from '@/components/admin/TableQrCodes';

export default function AdminQrCodesPage() {
  return (
    <div>
      <div className="mb-8">
        <p className="eyebrow">Dine-In</p>
        <h1 className="section-heading mt-1">QR Codes</h1>
      </div>
      <TableQrCodes />
    </div>
  );
}
