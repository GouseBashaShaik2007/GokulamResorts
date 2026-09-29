import PromotionsManager from '@/components/admin/PromotionsManager';

export default function AdminOffersPage() {
  return (
    <div>
      <div className="mb-8">
        <p className="eyebrow">Pricing</p>
        <h1 className="section-heading mt-1">Offers</h1>
      </div>
      <PromotionsManager />
    </div>
  );
}
