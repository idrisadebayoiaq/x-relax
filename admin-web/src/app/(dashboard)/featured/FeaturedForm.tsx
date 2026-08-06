'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function FeaturedForm() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const router = useRouter();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    const { error } = await supabase.from('featured_collections').insert({
      title: title.trim(),
      description: description.trim() || null,
      is_active: true,
      sort_order: 99,
    });
    if (error) alert(error.message);
    else {
      await supabase.rpc('log_admin_action', {
        p_action: 'create_featured_collection',
        p_entity_type: 'featured_collection',
        p_meta: { title },
      });
      setTitle('');
      setDescription('');
      router.refresh();
    }
  };

  return (
    <form onSubmit={onSubmit} className="border border-border rounded-xl p-4 space-y-3">
      <div className="font-medium">Add collection</div>
      <input
        className="w-full border border-border rounded-lg px-3 py-2 bg-background"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <input
        className="w-full border border-border rounded-lg px-3 py-2 bg-background"
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <button className="rounded-lg bg-foreground text-background px-4 py-2 font-semibold">
        Create
      </button>
    </form>
  );
}
