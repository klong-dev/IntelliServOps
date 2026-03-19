export type InvoiceContentItem = {
  description: string;
  amount: number;
  quantity: number;
  itemType: string;
};

export type InvoiceContentPayload = {
  title?: string | null;
  description?: string | null;
  items: InvoiceContentItem[];
};

export type PaymentInvoiceContent = {
  invoiceId: string;
  invoiceNumber: string;
  invoiceType: string;
  currency: string;
  baseRent: number;
  taxAmount: number;
  totalAmount: number;
  items: InvoiceContentItem[];
  content: InvoiceContentPayload;
};
