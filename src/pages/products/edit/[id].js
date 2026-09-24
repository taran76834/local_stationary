import ProductForm from '@/components/ProductForm';

export default function EditProductPage({ productId }) {
  if (!productId) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', color: '#64748b' }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Loading product details…</div>
      </div>
    );
  }

  return <ProductForm productId={productId} />;
}

export async function getServerSideProps(context) {
  const { id } = context.params || {};
  return {
    props: {
      productId: id || null,
    },
  };
}
