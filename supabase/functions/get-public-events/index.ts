import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    console.log('Fetching public website events...');

    // Query published, non-expired events ordered by display_order then created_at
    const { data: events, error } = await supabase
      .from('website_events')
      .select('id, title, description, image_url, event_date, event_end_date, display_order')
      .eq('is_published', true)
      .or('expires_at.is.null,expires_at.gt.now()')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching events:', error);
      throw error;
    }

    console.log(`Found ${events?.length || 0} published events`);

    return new Response(
      JSON.stringify({
        success: true,
        events: events || [],
        count: events?.length || 0
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in get-public-events:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        events: []
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
