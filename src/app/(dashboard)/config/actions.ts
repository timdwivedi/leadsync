'use server'

import { saveLocalConfig } from '@/utils/config'
import { revalidatePath } from 'next/cache'

export async function saveConfig(formData: FormData) {
  
  const updates = {
    apify_key: formData.get('apify_key') as string,
    openai_key: formData.get('openai_key') as string,
    anthropic_key: formData.get('anthropic_key') as string,
    prospeo_key: formData.get('prospeo_key') as string,
    personalization_prompt: formData.get('personalization_prompt') as string,
  }

  saveLocalConfig(updates)
  
  revalidatePath('/config')
}
