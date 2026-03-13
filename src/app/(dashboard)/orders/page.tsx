import { createClient } from '@/utils/supabase/server'
import OrdersClient from './OrdersClient'

export const dynamic = 'force-dynamic'

export default async function OrdersPage() {
  const supabase = await createClient()
  
  let orders: any[] = [];

  // Real DB fetch
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project-url')) {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      if (data) {
        orders = data;
      }
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>Job Orders</h1>
        <p style={{ color: 'var(--text-secondary)' }}>View the history of your scraping jobs and download the final enriched CSVs.</p>
      </div>

      <OrdersClient orders={orders} />
    </div>
  )
}
