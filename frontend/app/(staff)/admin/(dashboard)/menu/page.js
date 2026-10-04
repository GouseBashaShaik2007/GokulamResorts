import MenuManager from '@/components/admin/MenuManager';
import PageHeader from '@/components/ui/PageHeader';

export const metadata = { title: 'Menu' };

export default function AdminMenuPage() {
  return (
    <div>
      <PageHeader size="section" eyebrow="Food &amp; Beverage" title="Menu" className="mb-8" />
      <MenuManager />
    </div>
  );
}
