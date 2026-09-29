import FoodOrdersManager from '@/components/admin/FoodOrdersManager';

export default function AdminOrdersPage() {
  return (
    <div>
      <div className="mb-8">
        <p className="eyebrow">Food &amp; Beverage</p>
        <h1 className="section-heading mt-1">Food Orders</h1>
      </div>
      <FoodOrdersManager />
    </div>
  );
}
