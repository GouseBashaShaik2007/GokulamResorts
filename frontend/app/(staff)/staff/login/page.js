import LoginCard from '../../_components/LoginCard';

export const metadata = { title: 'Staff sign-in' };

// One sign-in for the front desk and every housekeeping role; where it lands
// afterwards depends on the role that comes back (see useStaffLogin).
export default function StaffLoginPage() {
  return (
    <LoginCard
      section="staff"
      eyebrow="Staff"
      idField={{
        name: 'phone',
        label: 'Phone number',
        type: 'tel',
        inputMode: 'tel',
        hint: 'The mobile number your manager registered for you. Spaces and +91 don’t matter.',
      }}
      help="Forgotten your password? Ask your manager — they can set a new one in Admin → Staff."
    />
  );
}
