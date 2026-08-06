import { createClient } from '@/lib/supabase/server';
import { SettingsEditor } from './SettingsEditor';
import { PlansEditor } from './PlansEditor';

export default async function SettingsPage() {
  const supabase = await createClient();
  const [{ data: flags }, { data: methods }, { data: plans }] = await Promise.all([
    supabase.from('app_settings').select('value').eq('key', 'feature_flags').maybeSingle(),
    supabase.from('app_settings').select('value').eq('key', 'payment_methods').maybeSingle(),
    supabase.from('subscription_plans').select('*').order('sort_order'),
  ]);

  return (
    <div className="max-w-3xl space-y-10">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted mt-2">Feature flags, payment methods, subscription plans</p>
      </div>

      <section>
        <h2 className="text-xl font-semibold mb-3">Feature flags (JSON)</h2>
        <SettingsEditor
          settingKey="feature_flags"
          initialValue={JSON.stringify(flags?.value ?? {}, null, 2)}
        />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">Payment methods (JSON)</h2>
        <SettingsEditor
          settingKey="payment_methods"
          initialValue={JSON.stringify(methods?.value ?? {}, null, 2)}
        />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">Subscription plans</h2>
        <PlansEditor plans={plans ?? []} />
      </section>
    </div>
  );
}
