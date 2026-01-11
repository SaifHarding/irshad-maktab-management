import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { postcode, query, id }: { postcode?: string; query?: string; id?: string } = await req.json();
    
    const apiKey = Deno.env.get('GETADDRESS_API_KEY');
    if (!apiKey) {
      console.error('GETADDRESS_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Address lookup service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get full address details by ID
    if (id) {
      console.log(`Getting address details for ID: ${id}`);
      const response = await fetch(
        `https://api.getaddress.io/get/${encodeURIComponent(id)}?api-key=${apiKey}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`GetAddress API error: ${response.status} - ${errorText}`);
        return new Response(
          JSON.stringify({ error: 'Failed to get address details' }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      return new Response(
        JSON.stringify({
          address: {
            line1: data.line_1 || '',
            line2: data.line_2 || '',
            town: data.town_or_city || '',
            county: data.county || '',
            postcode: data.postcode || '',
            formatted: [
              data.line_1,
              data.line_2,
              data.line_3,
              data.town_or_city,
              data.county,
            ].filter(Boolean).join(', '),
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Autocomplete search
    if (query) {
      if (query.trim().length < 3) {
        return new Response(
          JSON.stringify({ suggestions: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Autocomplete search: ${query}`);
      const response = await fetch(
        `https://api.getaddress.io/autocomplete/${encodeURIComponent(query.trim())}?api-key=${apiKey}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`GetAddress API error: ${response.status} - ${errorText}`);
        return new Response(
          JSON.stringify({ suggestions: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      const suggestions = data.suggestions?.map((s: any) => ({
        id: s.id,
        address: s.address,
      })) || [];

      console.log(`Found ${suggestions.length} suggestions`);
      return new Response(
        JSON.stringify({ suggestions }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Postcode lookup
    if (postcode) {
      const cleanPostcode = postcode.replace(/\s+/g, '').toUpperCase();
      console.log(`Looking up postcode: ${cleanPostcode}`);

      const response = await fetch(
        `https://api.getaddress.io/find/${encodeURIComponent(cleanPostcode)}?api-key=${apiKey}&expand=true`,
        { method: 'GET' }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`GetAddress API error: ${response.status} - ${errorText}`);
        
        if (response.status === 404) {
          return new Response(
            JSON.stringify({ addresses: [], message: 'No addresses found for this postcode' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        if (response.status === 401) {
          return new Response(
            JSON.stringify({ error: 'Invalid API key' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ error: 'Failed to lookup address' }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      console.log(`Found ${data.addresses?.length || 0} addresses`);

      const addresses = data.addresses?.map((addr: any) => ({
        line1: addr.line_1 || '',
        line2: addr.line_2 || '',
        line3: addr.line_3 || '',
        line4: addr.line_4 || '',
        town: addr.town_or_city || '',
        county: addr.county || '',
        postcode: data.postcode || cleanPostcode,
        formatted: [
          addr.line_1,
          addr.line_2,
          addr.line_3,
          addr.line_4,
          addr.town_or_city,
          addr.county,
        ].filter(Boolean).join(', '),
      })) || [];

      return new Response(
        JSON.stringify({ addresses, postcode: data.postcode || cleanPostcode }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Either postcode, query, or id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in address-lookup function:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
