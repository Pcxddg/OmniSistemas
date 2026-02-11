
export enum OrderType {
  DINE_IN = 'Comer aquí',
  DELIVERY = 'Delivery',
  TAKEAWAY = 'Para llevar',
  PENDING = 'Pendiente'
}

export type PaymentMethodType = 'efectivo' | 'digital' | 'mixto';

export interface OrderTypeConfig {
  id: string;
  name: string;
  pay_before: boolean;
  requires_table: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface CategoryConfig {
  id: string;
  name: string;
  sort_order: number;
  is_visible: boolean;
  created_at: string;
}

export interface ZoneConfig {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface TableConfig {
  id: string;
  name: string;
  zone_id: string;
  capacity: number;
  is_active: boolean;
  created_at: string;
}

export interface TerminalConfig {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  type: PaymentMethodType;
  currency: string;
  is_active: boolean;
  requires_reference: boolean;
  icon?: string;
  sort_order: number;
  created_at?: string;
}

export enum ProductType {
  SIMPLE = 'simple',
  COMPOUND = 'compuesto',
  PRODUCTION = 'produccion'
}

export enum InventoryAdjustmentType {
  RECEPCION = 'Recepción Compra',
  MERMA = 'Merma / Desperdicio',
  CONSUMO_INTERNO = 'Consumo Interno',
  ERROR_ADMIN = 'Error Administrativo',
  AUDITORIA = 'Corrección Auditoría'
}

export interface RecipeIngredient {
  id: string;
  product_id: string;
  ingredient_id: string;
  quantity: number;
  created_at?: string;
  // Join field for UI display
  ingredient?: Product;
}

export interface Product {
  id: string;
  name: string;
  type: ProductType;
  is_active: boolean;
  category_id: string;
  price: number;
  base_cost: number;
  stock: number;
  min_stock: number;
  image_url?: string;
  is_producible: boolean;
  created_at?: string;
  recipe?: RecipeIngredient[];
}

export interface Modifier {
  id: string;
  name: string;
  price: number;
  cost: number;
  is_active: boolean;
  inventory_product_id?: string;
  quantity_consumed?: number;
  created_at?: string;
}

export type Supplier = {
  id: string;
  name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  tax_id?: string;
  is_active: boolean;
  created_at?: string;
};

export type SupplierProduct = {
  id: string;
  supplier_id: string;
  product_id: string;
  sku_supplier?: string;
  unit_cost: number;
  currency: string;
  last_updated: string;
  products?: { name: string }; // Join relation
};

export type PurchaseOrder = {
  id: string;
  supplier_id: string;
  status: 'draft' | 'sent' | 'received' | 'cancelled';
  order_date: string;
  expected_date?: string;
  user_id?: string;
  total_estimated: number;
  notes?: string;
  created_at: string;
  suppliers?: { name: string }; // Join relation
};

export type PurchaseOrderItem = {
  id: string;
  purchase_order_id: string;
  product_id: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  products?: { name: string };
};

export interface ModifierOption {
  id: string;
  name: string;
  price: number;       // Impacto en Precio Venta
  cost: number;        // Impacto en Costo Real
  inventoryItemId?: string; // ID del insumo a descontar (UUID)
  consumption?: number;     // Cantidad a descontar
}

export interface ModifierGroup {
  id: string;
  name: string;
  options: ModifierOption[];
}

export interface CartItem extends Product {
  cartId: string;
  quantity: number;
  modifiers?: ModifierOption[]; // Updated to store full objects, not just strings
  notes?: string;
}

export interface Order {
  id: string;
  table?: string;
  customer?: string;
  type: OrderType;
  items: CartItem[];
  totalUSD: number;
  exchangeRate: number;
  status: 'active' | 'completed' | 'cancelled';
  date: string;
  paymentMethod?: PaymentMethod;
  subtotal?: number;
  tax?: number;
}


// NEW: Detailed Purchase Order Structure

export interface ProductionOrder {
  id: string;
  product_id: string;
  product_name?: string; // Derived from join
  quantity: number;
  status: 'draft' | 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
  created_at: string;
  produced_unit_cost?: number;
  user_id?: string;
}

export interface ProductLog {
  id: string;
  product_id: string;
  action: 'create' | 'update' | 'delete' | 'deactivate' | 'activate';
  changed_fields?: any;
  previous_values?: any;
  user_id: string;
  created_at: string;
}

export interface InventoryMovement {
  id: string;
  product_id: string;
  type: 'entrada' | 'salida' | 'ajuste';
  quantity: number;
  reason: string;
  user_id?: string;
  created_at: string;
}


export interface OrderPayment {
  id?: string;
  payment_method_id: string;
  amount: number;
}

export interface OrderItemModifier {
  id?: string;
  order_item_id?: string;
  modifier_id: string;
  modifier_name_snapshot: string;
  modifier_price_snapshot: number;
  modifier_cost_snapshot: number;
}

export interface CashRegister {
  id: string;
  opening_time: string;
  closing_time?: string;
  status: 'open' | 'closed';
  opened_by: string; // User ID
  closed_by?: string; // User ID
  opening_amount: number;
  closing_amount?: number;
  notes?: string;
}

export interface AuditLog {
  id: string;
  entity: string;
  entity_id: string;
  action: 'create' | 'update' | 'delete' | 'confirm' | 'cancel' | string;
  user_id?: string;
  old_value?: any;
  new_value?: any;
  created_at: string;
}

