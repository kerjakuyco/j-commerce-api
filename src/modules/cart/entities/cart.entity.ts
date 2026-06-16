export interface CartItemProductEntity {
  id: string;
  name: string;
  slug: string;
  brand: string;
  basePrice: number;
  discountPrice: number | null;
  image: string | null;
  category: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
  };
}

export interface CartItemVariantEntity {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
}

export interface CartItemEntity {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
  selected: boolean;
  price: number;
  subtotal: number;
  createdAt: Date;
  updatedAt: Date;
  product: CartItemProductEntity;
  variant: CartItemVariantEntity;
}

export interface CartSummaryEntity {
  totalItems: number;
  totalQuantity: number;
  selectedQuantity: number;
  subtotal: number;
  selectedSubtotal: number;
}

export interface CartEntity {
  items: CartItemEntity[];
  summary: CartSummaryEntity;
}
