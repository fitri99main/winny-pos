const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://lmgzsfivhdoczbgoshyu.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtZ3pzZml2aGRvY3piZ29zaHl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NjU2NTQsImV4cCI6MjA5NDU0MTY1NH0.RxEztkIUOMtPDk90PrLbiKCitGA-5GlXAWWxiMxd36I');

async function check() {
  // Find ingredient
  const { data: ingredients, error: err } = await supabase.from('ingredients').select('id, name, unit').ilike('name', '%air mineral%');
  console.log('Error:', err);
  console.log('Ingredients found:', ingredients);

  if (ingredients && ingredients.length > 0) {
    for (const ing of ingredients) {
      console.log('--- Checking movements for:', ing.name, '(', ing.id, ') ---');
      const { data: movements1 } = await supabase.from('stock_movements').select('id, ingredient_id, ingredientId').eq('ingredient_id', ing.id).limit(2);
      console.log('Movements with ingredient_id:', movements1);
      
      const { data: movements2 } = await supabase.from('stock_movements').select('id, ingredient_id, ingredientId').eq('ingredientId', ing.id).limit(2);
      console.log('Movements with ingredientId:', movements2);
    }
  }
}
check();
