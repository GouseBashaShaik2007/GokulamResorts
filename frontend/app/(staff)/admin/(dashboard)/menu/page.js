import MenuManager from '@/components/admin/MenuManager';

export default function AdminMenuPage() {
  return (
    <div>
      <div className="mb-8">
        <p className="eyebrow">Food &amp; Beverage</p>
        <h1 className="section-heading mt-1">Menu</h1>
      </div>
      <MenuManager />
    </div>
  );
}
