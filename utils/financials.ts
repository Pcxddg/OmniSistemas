
import { Order, CartItem } from '../types';

export const calculateLineItemCost = (item: any): number => {
    const quantity = item.quantity;
    const baseCost = item.unit_cost || item.base_cost || 0; // Support both OrderItem and CartItem

    let modifiersCost = 0;
    if (item.modifiers && Array.isArray(item.modifiers)) {
        modifiersCost = item.modifiers.reduce((acc: number, mod: any) => acc + (mod.cost || 0), 0);
    }

    return (baseCost + modifiersCost) * quantity;
};

export const calculateOrderTotalCost = (items: any[]): number => {
    if (!items) return 0;
    return items.reduce((acc, item) => acc + calculateLineItemCost(item), 0);
};

export const calculateOrderProfit = (order: Order | any): number => {
    const revenue = order.subtotal || (order.total / (1 + (order.tax_rate || 0))); // Fallback estimate
    const cost = calculateOrderTotalCost(order.items || order.order_items || []);
    return revenue - cost;
};
