import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, UtensilsCrossed, Coffee, Moon, Apple, Loader } from 'lucide-react';
import CustomerSiteHeader from '../components/CustomerSiteHeader';
import { Footer } from '../sections/Footer/Footer';
import { supabase } from '../../config/supabase';
import { DAYS_OF_WEEK, MEAL_TYPES, dayToColumnPrefix, DayOfWeek, MealTypeKey } from '../../types/mealTypes';
import { getCurrentMexicoDateString } from '../../utils/timezone';

interface RecipeInfo {
  recipe_id: string;
  recipe_name: string;
  recipe_image: string;
}

interface DayMenu {
  day: DayOfWeek;
  meals: { label: string; key: MealTypeKey; recipe: RecipeInfo | null }[];
}

const MEAL_ICONS: Record<MealTypeKey, React.ReactNode> = {
  desayuno: <Coffee className="w-4 h-4" />,
  colacion_am: <Apple className="w-4 h-4" />,
  comida: <UtensilsCrossed className="w-4 h-4" />,
  colacion_pm: <Apple className="w-4 h-4" />,
  cena: <Moon className="w-4 h-4" />,
};

export default function CustomerWeeklyMenuPage() {
  const [loading, setLoading] = useState(true);
  const [weekName, setWeekName] = useState('');
  const [weekDate, setWeekDate] = useState('');
  const [dayMenus, setDayMenus] = useState<DayMenu[]>([]);
  const [mealPlans, setMealPlans] = useState<{ id: string; name: string }[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadMenu();
  }, []);

  useEffect(() => {
    if (selectedPlan) {
      loadRecipesForPlan(selectedPlan);
    }
  }, [selectedPlan]);

  const loadMenu = async () => {
    try {
      setLoading(true);
      const today = getCurrentMexicoDateString();

      const { data: weeks, error: weekError } = await supabase
        .from('weeks')
        .select(`*, weekly_menus!inner(menu_name, menu_id)`)
        .gte('week_date', today)
        .order('week_date', { ascending: true })
        .limit(1);

      if (weekError) throw weekError;
      if (!weeks || weeks.length === 0) {
        setError('no_menu');
        return;
      }

      const week = weeks[0];
      setWeekName(week.week_name);
      setWeekDate(week.week_date);

      const menuId = week.weekly_menus?.menu_id;
      if (!menuId) {
        setError('no_menu');
        return;
      }

      const { data: menuRecipes, error: mrError } = await supabase
        .from('menu_recipes')
        .select('meal_plan_id')
        .eq('menu_id', menuId);

      if (mrError) throw mrError;
      if (!menuRecipes || menuRecipes.length === 0) {
        setError('no_recipes');
        return;
      }

      const planIds = [...new Set(menuRecipes.map(r => r.meal_plan_id))];

      const { data: plans, error: plansError } = await supabase
        .from('meal_plans')
        .select('meal_plans_id, meal_plans_name')
        .in('meal_plans_id', planIds)
        .order('meal_plans_name');

      if (plansError) throw plansError;

      const formattedPlans = (plans || []).map(p => ({
        id: p.meal_plans_id,
        name: p.meal_plans_name,
      }));

      setMealPlans(formattedPlans);
      if (formattedPlans.length > 0) {
        setSelectedPlan(formattedPlans[0].id);
      }
    } catch (err: any) {
      console.error('Error loading menu:', err);
      setError('error');
    } finally {
      setLoading(false);
    }
  };

  const loadRecipesForPlan = async (planId: string) => {
    try {
      const today = getCurrentMexicoDateString();

      const { data: weeks } = await supabase
        .from('weeks')
        .select(`*, weekly_menus!inner(menu_id)`)
        .gte('week_date', today)
        .order('week_date', { ascending: true })
        .limit(1);

      if (!weeks || weeks.length === 0) return;

      const menuId = weeks[0].weekly_menus?.menu_id;
      if (!menuId) return;

      const { data: menuRecipe } = await supabase
        .from('menu_recipes')
        .select('*')
        .eq('menu_id', menuId)
        .eq('meal_plan_id', planId)
        .maybeSingle();

      if (!menuRecipe) {
        setDayMenus([]);
        return;
      }

      const recipeIds: string[] = [];
      DAYS_OF_WEEK.forEach(day => {
        const prefix = dayToColumnPrefix(day);
        MEAL_TYPES.forEach(mt => {
          const col = `${prefix}_${mt.key}_recipe_id`;
          const id = menuRecipe[col];
          if (id) recipeIds.push(id);
        });
      });

      const uniqueIds = [...new Set(recipeIds)];
      let recipesMap = new Map<string, RecipeInfo>();

      if (uniqueIds.length > 0) {
        const { data: recipes } = await supabase
          .from('recipes')
          .select('recipe_id, recipe_name, recipe_image')
          .in('recipe_id', uniqueIds);

        if (recipes) {
          recipes.forEach(r => recipesMap.set(r.recipe_id, r));
        }
      }

      const days: DayMenu[] = DAYS_OF_WEEK.map(day => {
        const prefix = dayToColumnPrefix(day);
        const meals = MEAL_TYPES.map(mt => {
          const col = `${prefix}_${mt.key}_recipe_id`;
          const recipeId = menuRecipe[col];
          return {
            label: mt.label,
            key: mt.key,
            recipe: recipeId ? recipesMap.get(recipeId) || null : null,
          };
        });
        return { day, meals };
      });

      setDayMenus(days);
    } catch (err) {
      console.error('Error loading recipes for plan:', err);
    }
  };

  const resolveImage = (path: string): string => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const { data } = supabase.storage.from('website-media').getPublicUrl(path);
    return data?.publicUrl || path;
  };

  const formatWeekDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 4);

    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    const start = date.toLocaleDateString('es-MX', options);
    const end = endDate.toLocaleDateString('es-MX', { ...options, year: 'numeric' });
    return `${start} - ${end}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <CustomerSiteHeader />
        <div className="flex items-center justify-center py-32">
          <Loader className="w-8 h-8 animate-spin text-red-500" />
        </div>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <CustomerSiteHeader />
        <div className="max-w-3xl mx-auto px-4 py-24 text-center">
          <UtensilsCrossed className="w-16 h-16 text-gray-300 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-gray-800 mb-3">
            {error === 'no_menu' || error === 'no_recipes'
              ? 'El menú de la próxima semana aún no está disponible'
              : 'Hubo un problema al cargar el menú'}
          </h1>
          <p className="text-gray-500 mb-8">
            {error === 'no_menu' || error === 'no_recipes'
              ? 'Vuelve pronto, estamos preparando platillos deliciosos para ti.'
              : 'Por favor intenta de nuevo más tarde.'}
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-medium transition-colors"
          >
            Volver al inicio
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CustomerSiteHeader />

      {/* Hero */}
      <section className="bg-gradient-to-br from-red-500 to-red-600 text-white py-16 md:py-20">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3">
            Menú de la Semana
          </h1>
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-5 py-2 mt-4">
            <Calendar className="w-5 h-5" />
            <span className="font-medium">{weekName}</span>
            {weekDate && (
              <span className="text-white/80 text-sm">
                &middot; {formatWeekDate(weekDate)}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Plan Selector */}
      {mealPlans.length > 1 && (
        <div className="max-w-6xl mx-auto px-4 -mt-6 relative z-10">
          <div className="bg-white rounded-2xl shadow-lg p-4 flex flex-wrap gap-2 justify-center">
            {mealPlans.map(plan => (
              <button
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  selectedPlan === plan.id
                    ? 'bg-red-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {plan.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Menu Grid */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        {dayMenus.length === 0 ? (
          <p className="text-center text-gray-400 py-12">
            No hay recetas asignadas para este plan.
          </p>
        ) : (
          <div className="space-y-10">
            {dayMenus.map(dayMenu => {
              const hasRecipes = dayMenu.meals.some(m => m.recipe);
              if (!hasRecipes) return null;

              return (
                <div key={dayMenu.day}>
                  <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 bg-red-100 text-red-600 rounded-lg flex items-center justify-center text-sm font-bold">
                      {dayMenu.day.charAt(0)}
                    </span>
                    {dayMenu.day}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                    {dayMenu.meals.map(meal => {
                      if (!meal.recipe) return null;
                      const imgUrl = meal.recipe.recipe_image
                        ? resolveImage(meal.recipe.recipe_image)
                        : '';

                      return (
                        <div
                          key={`${dayMenu.day}-${meal.key}`}
                          className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group"
                        >
                          <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
                            {imgUrl ? (
                              <img
                                src={imgUrl}
                                alt={meal.recipe.recipe_name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <UtensilsCrossed className="w-10 h-10 text-gray-300" />
                              </div>
                            )}
                            <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-white/90 backdrop-blur-sm text-gray-700 text-xs font-medium px-2.5 py-1 rounded-full shadow-sm">
                              {MEAL_ICONS[meal.key]}
                              {meal.label}
                            </span>
                          </div>
                          <div className="p-3">
                            <p className="text-sm font-medium text-gray-800 leading-tight line-clamp-2">
                              {meal.recipe.recipe_name}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* CTA */}
        <div className="mt-16 text-center">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 md:p-12 max-w-2xl mx-auto">
            <h3 className="text-2xl font-bold text-white mb-3">
              ¿Te gusta lo que ves?
            </h3>
            <p className="text-gray-300 mb-6">
              Ordena tu plan semanal y recibe comida saludable y deliciosa en la puerta de tu casa.
            </p>
            <Link
              to="/order"
              className="inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-8 py-3.5 rounded-xl font-semibold transition-colors"
            >
              <UtensilsCrossed className="w-5 h-5" />
              Ordenar Ahora
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
