import Kiosk from '@/components/kiosk/Kiosk';

// The kiosk tablet in the restaurant (see lib/kiosk.js). Opened once with the
// set-up link from Admin → QR Codes; on any other device it only explains
// what it is.
export default function KioskPage() {
  return <Kiosk />;
}
