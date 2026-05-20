import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'

// ── Excel Export ──────────────────────────────────────────────────────────────

/**
 * Export an array of objects to .xlsx
 * @param {Object[]} data
 * @param {string}   sheetName
 * @param {string}   fileName  - without extension
 */
export function exportToExcel(data, sheetName = 'Sheet1', fileName = 'silgen-export') {
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `${fileName}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
}

/** Export orders to Excel */
export function exportOrders(orders) {
  const rows = orders.map(o => ({
    'Order Ref':      o.ref,
    'Date':           format(new Date(o.created), 'dd/MM/yyyy HH:mm'),
    'Customer':       o.expand?.user_id?.name || o.user_id,
    'Status':         o.status,
    'Payment':        o.payment_status,
    'Method':         o.payment_method,
    'Subtotal (KES)': o.subtotal_kes,
    'Discount (KES)': o.discount_kes || 0,
    'Delivery (KES)': o.delivery_fee_kes || 0,
    'Total (KES)':    o.total_kes,
    'Source':         o.source,
  }))
  exportToExcel(rows, 'Orders', 'silgen-orders')
}

/** Export customers to Excel */
export function exportCustomers(customers) {
  const rows = customers.map(c => ({
    'Name':            c.name,
    'Email':           c.email,
    'Phone':           c.phone,
    'Country':         c.country || 'KE',
    'Currency':        c.currency || 'KES',
    'Diaspora':        c.is_diaspora ? 'Yes' : 'No',
    'Loyalty Points':  c.loyalty_points || 0,
    'Referral Code':   c.referral_code || '',
    'WhatsApp Opt-in': c.whatsapp_opt_in ? 'Yes' : 'No',
    'Active':          c.is_active ? 'Yes' : 'No',
    'Last Seen':       c.last_seen ? format(new Date(c.last_seen), 'dd/MM/yyyy') : '',
    'Registered':      format(new Date(c.created), 'dd/MM/yyyy'),
  }))
  exportToExcel(rows, 'Customers', 'silgen-customers')
}

/** Export inventory to Excel */
export function exportInventory(items) {
  const rows = items.map(i => ({
    'Product':         i.expand?.product_id?.name_en || i.product_id,
    'Variant SKU':     i.variant_sku || '-',
    'On Hand':         i.qty_on_hand || 0,
    'Reserved':        i.qty_reserved || 0,
    'Available':       i.qty_available || 0,
    'Reorder Point':   i.reorder_point || 0,
    'Reorder Qty':     i.reorder_qty || 0,
    'Location':        i.location || '-',
  }))
  exportToExcel(rows, 'Inventory', 'silgen-inventory')
}

/** Export loyalty ledger to Excel */
export function exportLoyalty(transactions) {
  const rows = transactions.map(tx => ({
    'Date':          format(new Date(tx.created), 'dd/MM/yyyy HH:mm'),
    'Customer':      tx.expand?.user_id?.name || tx.user_id,
    'Type':          tx.type,
    'Points':        tx.points,
    'Balance After': tx.balance_after,
    'Description':   tx.description || '',
    'Order':         tx.expand?.order_id?.ref || tx.order_id || '-',
    'Expires':       tx.expires_at ? format(new Date(tx.expires_at), 'dd/MM/yyyy') : 'Never',
  }))
  exportToExcel(rows, 'Loyalty', 'silgen-loyalty')
}

// ── PDF Export ────────────────────────────────────────────────────────────────

/**
 * Generate an order invoice PDF.
 * @param {Object} order   - sg_orders record with expand
 * @param {Object[]} items - sg_order_items records
 */
export function exportOrderInvoice(order, items) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()

  // Header
  doc.setFillColor(5, 150, 105) // emerald-600
  doc.rect(0, 0, pageWidth, 40, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('SILGEN', 14, 18)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Shop Smart, Live Well', 14, 26)
  doc.text('info@silgen.co.ke  |  silgen.vercel.app', 14, 33)

  // Invoice title
  doc.setTextColor(30, 41, 59)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(`INVOICE — ${order.ref}`, 14, 55)

  // Order meta
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(107, 114, 128)
  doc.text(`Date: ${format(new Date(order.created), 'dd MMM yyyy HH:mm')}`, 14, 63)
  doc.text(`Status: ${order.status?.toUpperCase()}`, 14, 69)
  doc.text(`Payment: ${order.payment_method?.toUpperCase()} — ${order.payment_status?.toUpperCase()}`, 14, 75)

  // Customer info
  const customer = order.expand?.user_id
  if (customer) {
    doc.text(`Customer: ${customer.name}`, 110, 63)
    doc.text(`Phone: ${customer.phone || '-'}`, 110, 69)
    doc.text(`Email: ${customer.email || '-'}`, 110, 75)
  }

  // Items table
  autoTable(doc, {
    startY: 85,
    head: [['Product', 'Variant', 'Qty', 'Unit Price', 'Total']],
    body: items.map(i => [
      i.product_name || '-',
      i.variant_label || '-',
      i.qty,
      `KES ${Number(i.unit_price_kes).toLocaleString()}`,
      `KES ${Number(i.total_kes).toLocaleString()}`,
    ]),
    headStyles: { fillColor: [5, 150, 105], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [236, 253, 245] },
    columnStyles: { 0: { cellWidth: 70 } },
  })

  // Totals
  const finalY = doc.lastAutoTable.finalY + 8
  doc.setFontSize(9)
  doc.setTextColor(107, 114, 128)
  doc.text(`Subtotal:`, 130, finalY)
  doc.text(`KES ${Number(order.subtotal_kes).toLocaleString()}`, 175, finalY, { align: 'right' })

  if (order.discount_kes > 0) {
    doc.text(`Discount:`, 130, finalY + 6)
    doc.text(`- KES ${Number(order.discount_kes).toLocaleString()}`, 175, finalY + 6, { align: 'right' })
  }

  if (order.delivery_fee_kes > 0) {
    doc.text(`Delivery:`, 130, finalY + 12)
    doc.text(`KES ${Number(order.delivery_fee_kes).toLocaleString()}`, 175, finalY + 12, { align: 'right' })
  }

  const totalY = finalY + 18
  doc.setFillColor(5, 150, 105)
  doc.rect(125, totalY - 5, 70, 10, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(`TOTAL: KES ${Number(order.total_kes).toLocaleString()}`, 190, totalY + 1, { align: 'right' })

  // Footer
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(156, 163, 175)
  doc.text('Thank you for shopping with SILGEN 🇰🇪', pageWidth / 2, 285, { align: 'center' })
  doc.text('Powered by DoubleX Software & Consultants Solutions Ltd', pageWidth / 2, 290, { align: 'center' })

  doc.save(`SILGEN-Invoice-${order.ref}.pdf`)
}

/**
 * Export a purchase order as PDF.
 * @param {Object} po - sg_purchase_orders record
 */
export function exportPurchaseOrderPDF(po) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setFillColor(30, 41, 59)
  doc.rect(0, 0, pageWidth, 35, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('PURCHASE ORDER', 14, 16)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`PO#: ${po.po_number || 'N/A'}`, 14, 25)
  doc.text(`Status: ${po.status?.toUpperCase()}`, 14, 31)

  doc.setTextColor(30, 41, 59)
  doc.setFontSize(10)
  doc.text(`Supplier: ${po.supplier || '-'}`, 14, 48)
  doc.text(`Ordered: ${po.ordered_at ? format(new Date(po.ordered_at), 'dd MMM yyyy') : '-'}`, 14, 55)
  doc.text(`Expected: ${po.expected_at ? format(new Date(po.expected_at), 'dd MMM yyyy') : '-'}`, 14, 62)

  const items = po.items_json || []
  autoTable(doc, {
    startY: 72,
    head: [['Product', 'SKU', 'Qty', 'Unit Cost', 'Total']],
    body: items.map(i => [
      i.product_name || '-',
      i.sku || '-',
      i.qty,
      `KES ${Number(i.unit_cost || 0).toLocaleString()}`,
      `KES ${Number(i.total || 0).toLocaleString()}`,
    ]),
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
  })

  const finalY = doc.lastAutoTable.finalY + 10
  doc.setFont('helvetica', 'bold')
  doc.text(`Total Cost: KES ${Number(po.total_cost || 0).toLocaleString()}`, 14, finalY)

  if (po.notes) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(`Notes: ${po.notes}`, 14, finalY + 10)
  }

  doc.save(`SILGEN-PO-${po.po_number || 'draft'}.pdf`)
}