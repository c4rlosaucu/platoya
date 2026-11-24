export function serializeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

export function serializeDish(dish) {
  return {
    id: dish._id.toString(),
    name: dish.name,
    description: dish.description,
    category: dish.category,
    priceCents: dish.priceCents,
    available: dish.available,
    imageUrl: dish.imageUrl,
  };
}

export function serializeOrder(order) {
  return {
    id: order._id.toString(),
    items: order.items.map((item) => ({
      dishId: item.dishId.toString(),
      name: item.name,
      unitPriceCents: item.unitPriceCents,
      quantity: item.quantity,
      lineTotalCents: item.lineTotalCents,
    })),
    address: {
      line1: order.address.line1,
      city: order.address.city,
      reference: order.address.reference || "",
    },
    totalCents: order.totalCents,
    currency: order.currency,
    status: order.status,
    statusHistory: order.statusHistory.map((entry) => ({
      status: entry.status,
      at: entry.at,
      by: entry.by.toString(),
    })),
    paypalOrderId: order.paypalOrderId || "",
    createdAt: order.createdAt,
    paidAt: order.paidAt || null,
  };
}
