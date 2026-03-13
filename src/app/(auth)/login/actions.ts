'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  // mock login if keys aren't provided yet
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project-url')) {
    console.warn("Supabase keys missing, using mock login flow");
    // normally we would throw or error, but for the MVP demonstration we redirect
    redirect('/config')
  }

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/config', 'layout')
  redirect('/config')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  // mock signup if keys aren't provided yet
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project-url')) {
    console.warn("Supabase keys missing, using mock signup flow");
    redirect('/config')
  }

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error, data: authData } = await supabase.auth.signUp({
    ...data,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`,
    },
  })

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`)
  }
  
  // also create a default record in profiles for this user to store their keys
  if (authData.user) {
    const { error: profileError } = await supabase.from('profiles').insert([
       { id: authData.user.id }
    ])
    // ignore profile insertion error for now (it might fail if table doesn't exist)
  }

  revalidatePath('/config', 'layout')
  redirect('/config')
}
