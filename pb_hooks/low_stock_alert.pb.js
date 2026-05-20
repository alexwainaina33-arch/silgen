/// <reference path="../pb_data/types.d.ts" />

onRecordUpdateRequest((e) => {
  e.next()
  const record    = e.record
  const qtyAvail  = record.get('qty_available') || 0
  const reorderPt = record.get('reorder_point')  || 0
  const productId = record.get('product_id')
  if (reorderPt <= 0 || qtyAvail > reorderPt) return
  try {
    let productName = productId
    try {
      const product = $app.dao().findRecordById('sg_products', productId)
      productName   = product.get('name_en') || productId
    } catch(e) {}
    const variantSku = record.get('variant_sku') || ''
    const label      = variantSku ? `${productName} (${variantSku})` : productName
    $app.dao().saveRecord(
      new Record($app.dao().findCollectionByNameOrId('sg_notifications'), {
        user_id: '', type: 'system',
        title: '⚠️ Low Stock Alert',
        body:  `${label} has only ${qtyAvail} units left (reorder point: ${reorderPt})`,
        link:  '/admin/inventory', is_read: false,
      })
    )
    if (productId) {
      try {
        const product = $app.dao().findRecordById('sg_products', productId)
        product.set('stock_qty', qtyAvail)
        $app.dao().saveRecord(product)
      } catch(e) {}
    }
  } catch(e) {}
}, 'sg_inventory')