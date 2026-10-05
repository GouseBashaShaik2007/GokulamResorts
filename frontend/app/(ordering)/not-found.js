import ScanToOrder from '@/components/site/ScanToOrder';

export const metadata = { title: 'Scan the QR code to order' };

// An ordering address that isn't a table (/order/hello). The way in is the
// same as for a missing key: scan a code.
export default function OrderingNotFound() {
  return <ScanToOrder />;
}
