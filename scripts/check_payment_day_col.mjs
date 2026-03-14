import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkPaymentDay() {
  const { data, error } = await supabase.from('rooms').select('payment_day').limit(1)
  if (error) {
    if (error.message.includes('column "payment_day" does not exist') || error.code === 'PGRST106') {
      console.log('COLUMN_NOT_FOUND')
    } else {
      console.error('Error:', error)
    }
  } else {
    console.log('COLUMN_EXISTS', data)
  }
}

checkPaymentDay()
