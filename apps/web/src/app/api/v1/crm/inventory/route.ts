import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    // 1. Authenticate the request via internal API key
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.split(' ')[1];

    if (!token || token !== process.env.CRM_INTERNAL_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized system access' }, { status: 401 });
    }

    // 2. Parse the product payload sent from the mobile scraper
    const body = await request.json();
    const { type, title, base_price, source_url } = body;

    if (!title || base_price === undefined) {
      return NextResponse.json({ error: 'Missing required payload parameters' }, { status: 400 });
    }

    // 3. Inject the product directly into the PostgreSQL database
    const newProduct = await db.product.create({
      data: {
        type: type || 'physical',
        title: title,
        basePrice: parseFloat(base_price),
        sourceUrl: source_url || null,
        isActive: false,
      },
    });

    console.log(`[CRM API] Scraped item added successfully: ${newProduct.id}`);
    return NextResponse.json({ success: true, product: newProduct }, { status: 201 });

  } catch (error: any) {
    console.error('[CRM API Error]:', error);
    return NextResponse.json({ error: 'Internal Server Database Error', details: error.message }, { status: 500 });
  }
}
